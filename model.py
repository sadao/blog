# !/usr/bin/env python
#
# Copyright 2008 CPedia.com.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

__author__ = 'Ping Chen'

import pickle

import logging
import datetime
import urllib
import random
import cgi
import simplejson

from google.appengine.ext import search
from google.appengine.api import memcache
from google.appengine.ext import db
from google.appengine.api import users
from google.appengine.api import datastore_types

from cpedia.auth.models import EmailUser

def to_dict(model_obj, attr_list, init_dict_func=None):
    """Converts Model properties into various formats.

    Supply a init_dict_func function that populates a
    dictionary with values.  In the case of db.Model, this
    would be something like _to_entity().  You may also
    designate more complex properties in attr_list, like
      "counter.count"
    Each object in the chain will be retrieved.  In the
    example above, the counter object will be retrieved
    from model_obj's properties.  And then counter.count
    will be retrieved.  The value returned will have a
    key set to the last name in the chain, e.g. 'count'
    in the above example.
    """
    values = {}
    init_dict_func(values)
    for token in attr_list:
        elems = token.split('.')
        value = getattr(model_obj, elems[0])
        for elem in elems[1:]:
            value = getattr(value, elem)
        values[elems[-1]] = value
    if model_obj.is_saved():
        values['key'] =  str(model_obj.key())
    return values

# Format for conversion of datetime to JSON
DATE_FORMAT = "%Y-%m-%d"
TIME_FORMAT = "%H:%M:%S"

def replace_datastore_types(entity):
    """Replaces any datastore types in a dictionary with standard types.

    Passed-in entities are assumed to be dictionaries with values that
    can be at most a single list level.  These transformations are made:
      datetime.datetime      -> string
      db.Key                 -> key hash suitable for regenerating key
      users.User             -> dict with 'nickname' and 'email'
    TODO -- GeoPt when needed
    """
    def get_replacement(value):
        if isinstance(value, datetime.datetime):
            return value.strftime("%s %s" % (DATE_FORMAT, TIME_FORMAT))
        elif isinstance(value, datetime.date):
            return value.strftime(DATE_FORMAT)
        elif isinstance(value, datetime.time):
            return value.strftime(TIME_FORMAT)
        elif isinstance(value, datastore_types.Key):
            return str(value)
        elif isinstance(value, users.User):
            return { 'nickname': value.nickname(),
                     'email': value.email(),
                     'user_id':value.user_id() }
        else:
            return None

    for key, value in entity.iteritems():
        if isinstance(value, list):
            new_list = []
            for item in value:
                new_value = get_replacement(item)
                new_list.append(new_value or item)
            entity[key] = new_list
        else:
            new_value = get_replacement(value)
            if new_value:
                entity[key] = new_value

class SerializableModel(db.Model):
    """Extends Model to have json and possibly other serializations

    Use the class variable 'json_does_not_include' to declare properties
    that should *not* be included in json serialization.
    TODO -- Complete round-tripping
    """
    json_does_not_include = []

    def to_entity(self, entity):
        """Convert datastore types in entity to
           JSON-friendly structures."""
        #self._to_entity(entity)  bug from appengine 1.2.8
        for prop in self.properties().values():
          datastore_value = prop.get_value_for_datastore(self)
          if datastore_value == []:
            try:
              del entity[prop.name]
            except KeyError:
              pass
          else:
            entity[prop.name] = datastore_value

        for skipped_property in self.__class__.json_does_not_include:
            del entity[skipped_property]
        replace_datastore_types(entity)

    def to_json(self, attr_list=[]):
        def to_entity(entity):
           self.to_entity(entity)
        values = to_dict(self, attr_list, to_entity)
        #return simplejson.dumps(values)   #simplejson.dumps will be applied when do the rpc call.
        return values

class MemcachedModel(SerializableModel):
#All the query to this model need to be self-stored.
#The dict need to set a unique key, and the value must be db.Query() object.
    querys = {}
    list_includes = []
    
    def delete_cached_list(self):
        memcache_list_keys = self.__class__.memcache_list_key()
        if memcache_list_keys is not None and len(memcache_list_keys) > 0:
            memcache.delete_multi(memcache_list_keys)

    def delete(self):
        super(MemcachedModel, self).delete()
        self.delete_cached_list()
        if self.is_saved():
            memcache.delete(self.__class__.memcache_object_key(self.key()))

    def put(self):
        key = super(MemcachedModel, self).put()
        self.delete_cached_list()
        memcache.set(self.__class__.memcache_object_key(key),self)
        return key

    def _to_repr(self):
        return repr(to_dict(self, self.__class__.list_includes,
                    self.to_entity))

    @classmethod
    def get_or_insert(cls, key_name, **kwds):
        obj = super(MemcachedModel, cls).get_or_insert(key_name, **kwds)
        self.delete_cached_list()
        return obj

    @classmethod
    def memcache_list_key(cls):
        keys =  [cls.__name__ +"_list_" +  query_key  for query_key in cls.querys]
        keys += ['PS_' + cls.__name__ + '_ALL']
        return keys

    @classmethod
    def memcache_object_key(cls,primary_key):
        return cls.__name__ + '_' + str(primary_key)

    @classmethod
    def get_cached(cls,primary_key,nocache=False):
        key_ = cls.__name__ + "_" + primary_key
        try:
            result = memcache.get(key_)
        except Exception:
            result = None
        if nocache or result is None:
            result = cls.get(primary_key)
            memcache.set(key=key_, value=result)
        return result

    @classmethod
    def memcache_all_key(cls):
        return 'PS_' + cls.__name__ + '_ALL'

    @classmethod
    def list(cls, nocache=False):
        """Returns a list of up to 1000 dicts of model values.
           Unless nocache is set to True, memcache will be checked first.
        Returns:
          List of dicts with each dict holding an entities property names
          and values.
        """
        list_repr = memcache.get(cls.memcache_all_key())
        if nocache or list_repr is None:
            q = db.Query(cls)
            objs = q.fetch(limit=1000)
            list_repr = '[' + ','.join([obj._to_repr() for obj in objs]) + ']'
            memcache.set(cls.memcache_all_key(), list_repr)
        return eval(list_repr)
        
    @classmethod
    def get_cached_list(cls, query_key,params=[],nocache=False):
        """Return the cached list with the specified key.
        User must keep the key unique, and the query must
        be same instance of the class .
        """
        key_ = cls.__name__ +"_list_" + query_key
        try:
            result = memcache.get(key_)
        except Exception:
            result = None
        if nocache or result is None:
            if query_key in cls.querys:
                params_ = [cls.querys[query_key]] + params
                query = db.GqlQuery(*params_ )
                result = query.fetch(1000)
                memcache.add(key=key_, value=result)
            else:
                raise Exception("Query for object list does not define in the Class Model.")
        return result

class Counter(object):
    """A counter using sharded writes to prevent contentions.

    Should be used for counters that handle a lot of concurrent use.
    Follows pattern described in Google I/O talk:
        http://sites.google.com/site/io/building-scalable-web-applications-with-google-app-engine

    Memcache is used for caching counts, although you can force
    non-cached counts.

    Usage:
        hits = Counter('hits')
        hits.increment()
        hits.get_count()
        hits.get_count(nocache=True)  # Forces non-cached count.
        hits.decrement()
    """
    MAX_SHARDS = 50

    def __init__(self, name, num_shards=5, cache_time=30):
        self.name = name
        self.num_shards = min(num_shards, Counter.MAX_SHARDS)
        self.cache_time = cache_time

    def delete(self):
        q = db.Query(CounterShard).filter('name =', self.name)
        # Need to use MAX_SHARDS since current number of shards
        # may be smaller than previous value.
        shards = q.fetch(limit=Counter.MAX_SHARDS)
        for shard in shards:
            shard.delete()

    def memcache_key(self):
        return 'Counter' + self.name

    def get_count(self, nocache=False):
        total = memcache.get(self.memcache_key())
        if nocache or total is None:
            total = 0
            q = db.Query(CounterShard).filter('name =', self.name)
            shards = q.fetch(limit=Counter.MAX_SHARDS)
            for shard in shards:
                total += shard.count
            memcache.add(self.memcache_key(), str(total),
                         self.cache_time)
            return total
        else:
            logging.debug("Using cache on %s = %s", self.name, total)
            return int(total)
    count = property(get_count)

    def increment(self):
        CounterShard.increment(self.name, self.num_shards)
        return memcache.incr(self.memcache_key())

    def decrement(self):
        CounterShard.increment(self.name, self.num_shards,
                               downward=True)
        return memcache.decr(self.memcache_key())

class CounterShard(db.Model):
    name = db.StringProperty(required=True)
    count = db.IntegerProperty(default=0)

    @classmethod
    def increment(cls, name, num_shards, downward=False):
        index = random.randint(1, num_shards)
        shard_key_name = 'Shard' + name + str(index)
        def get_or_create_shard():
            shard = CounterShard.get_by_key_name(shard_key_name)
            if shard is None:
                shard = CounterShard(key_name=shard_key_name,
                                     name=name)
            if downward:
                shard.count -= 1
            else:
                shard.count += 1
            key = shard.put()
        try:
            db.run_in_transaction(get_or_create_shard)
            return True
        except db.TransactionFailedError():
            logging.error("CounterShard (%s, %d) - can't increment",
                          name, num_shards)
            return False

class Archive(MemcachedModel):
    monthyear = db.StringProperty(multiline=False)
    """July 2008"""
    weblogcount = db.IntegerProperty(default=0)
    date = db.DateTimeProperty(auto_now_add=True)

class Tag(MemcachedModel):
    tag = db.StringProperty(multiline=False)
    entrycount = db.IntegerProperty(default=0)
    valid = db.BooleanProperty(default = True)

class Weblog(SerializableModel):
    permalink = db.StringProperty()
    title = db.StringProperty()
    content = db.TextProperty()
    date = db.DateTimeProperty(auto_now_add=True)
    author = db.UserProperty()
    authorEmail = db.EmailProperty()
    catalog = db.StringProperty()
    lastCommentedDate = db.DateTimeProperty()
    commentcount = db.IntegerProperty(default=0)
    lastModifiedDate = db.DateTimeProperty()
    lastModifiedBy = db.UserProperty()
    tags = db.ListProperty(db.Category)
    monthyear = db.StringProperty(multiline=False)
    entrytype = db.StringProperty(multiline=False,default='post',choices=[
            'post','page'])
    _weblogId = db.IntegerProperty()   ##for data migration from the mysql system
    assoc_dict = db.BlobProperty()     # Pickled dict for sidelinks, associated Amazon items, etc.

    def relative_permalink(self):
        if self.entrytype == 'post':
            return self.date.strftime('%Y/%m/')+ self.permalink
        else:
            return self.permalink

    def full_permalink(self):
        if self.entrytype == 'post':
            return '/' + self.date.strftime('%Y/%m/')+ self.permalink
        else:
            return '/'+ self.permalink

    def get_tags(self):
        '''comma delimted list of tags'''
        return ','.join([urllib.unquote(tag.encode('utf8')) for tag in self.tags])

    def set_tags(self, tags):
        if tags:
            self.tags = [db.Category(urllib.quote(tag.strip().encode('utf8'))) for tag in tags.split(',')]

    tags_commas = property(get_tags,set_tags)

    #for data migration
    def update_archive(self,action):
        """Checks to see if there is a month-year entry for the
        month of current blog, if not creates it and increments count
        action: 0 update the blog.
                1 add a new blog.
                2 delete the blog.
        """
        my = self.date.strftime('%B %Y') # July 2008
        archive = Archive.all().filter('monthyear',my).fetch(10)
        if archive == []:
            archive = Archive(monthyear=my,date=self.date,weblogcount=1)
            archive.put()
        else:
            if action==1:
            # ratchet up the count
                archive[0].weblogcount += 1
                archive[0].put()
            elif action == 2:
                archive[0].weblogcount -= 1
                if archive[0].weblogcount == 0:
                    archive[0].delete()
                else:
                    archive[0].put()

    def update_tags(self,action):
        """Update Tag cloud info
        action: 0 update the blog.
                1 add a new blog.
                2 delete the blog.
        """
        if self.tags:
            for tag_ in self.tags:
            #tag_ = tag.encode('utf8')
                tags = Tag.all().filter('tag',tag_).fetch(10)
                if tags == []:
                    tagnew = Tag(tag=tag_,entrycount=1)
                    tagnew.put()
                else:
                    if action==1:
                        tags[0].entrycount+=1
                        tags[0].put()
                    elif action ==2:
                        tags[0].entrycount-=1
                        if tags[0].entrycount == 0:
                            tags[0].delete()
                        else:
                            tags[0].put()

    def save(self):
        self.update_tags(1)
        if self.entrytype == "post":
            self.update_archive(1)
        my = self.date.strftime('%B %Y') # July 2008
        self.monthyear = my
        self.put()

    def update(self):
        self.update_tags(0)
        if self.entrytype == "post":
            self.update_archive(0)
        self.put()

    def delete(self):
        self.update_tags(2)
        if self.entrytype == "post":
            self.update_archive(2)
        super(Weblog, self).delete()


class WeblogReactions(SerializableModel):
    weblog = db.ReferenceProperty(Weblog)
    user = db.StringProperty()
    date = db.DateTimeProperty(auto_now_add=True)
    author = db.UserProperty()
    authorEmail = db.EmailProperty()
    authorWebsite = db.StringProperty()
    userIp = db.StringProperty()
    content = db.TextProperty()
    lastModifiedDate = db.DateTimeProperty()
    lastModifiedBy = db.UserProperty()
    _weblogReactionId = db.IntegerProperty()   ##for data migration from the mysql system

    def save(self):
        self.put()
        if self.weblog is not None:
            self.weblog.lastCommentedDate = self.date
            self.weblog.commentcount += 1
            self.weblog.put()

class AuthSubStoredToken(db.Model):
    user_email = db.StringProperty(required=True)
    target_service = db.StringProperty(multiline=False,default='base',choices=[
            'apps','base','blogger','calendar','codesearch','contacts','docs',
            'albums','spreadsheet','youtube'])
    session_token = db.StringProperty(required=True)

class CPediaLog(SerializableModel):
    title = db.StringProperty(multiline=False, default='Your Blog Title')
    author = db.StringProperty(multiline=False, default='Your Blog Author')
    email = db.StringProperty(multiline=False, default='')
    description = db.StringProperty(default='Blog powered by cpedialog.')
    root_url = db.StringProperty(multiline=False,default='http://cpedialog.appspot.com')
    time_zone_offset = db.FloatProperty(default=-8.0)
    logo_images = db.ListProperty(db.Category)   #todo: this should named as banner images
    site_logo = db.StringProperty(multiline=False,default='/img/cpedia_zone.gif')
    description_next_logo = db.BooleanProperty(default = True)    
    num_post_per_page = db.IntegerProperty(default=8)
    cache_time = db.IntegerProperty(default=0)
    debug = db.BooleanProperty(default = True)

    recaptcha_enable = db.BooleanProperty(default = False)
    recaptcha_public_key = db.StringProperty(multiline=False,default='')
    recaptcha_private_key = db.StringProperty(multiline=False,default='')

    delicious_enable = db.BooleanProperty(default = False)
    delicious_username = db.StringProperty(multiline=False, default='cpedia')

    analytics_enable = db.BooleanProperty(default = False)
    analytics_web_property_id = db.StringProperty(multiline=False,default='')

    google_ajax_feed_enable = db.BooleanProperty(default = True)
    google_ajax_feed_key = db.StringProperty(multiline=False,
                                             default='ABQIAAAAOY_c0tDeN-DKUM-NTZldZhQG0TqTy2vJ9mpRzeM1HVuOe9SdDRSieJccw-q7dBZF5aGxGJ-oZDyf5Q'
            )  #this key only for support from google. It's optional.
    google_ajax_feed_result_num = db.IntegerProperty(default = 10)
    google_ajax_feed_title = db.StringProperty(multiline=False,default='Your feeds')

    host_ip = db.StringProperty()
    host_domain = db.StringProperty()
    default = db.BooleanProperty(default = True)

    def get_logo_images_list(self):
        '''space delimted list of tags'''
        if not self.logo_images:
            logog_images_ =  [self.root_url + "/img/logo/logo1.gif", self.root_url + "/img/logo/logo2.gif"]
            return logog_images_
        else:
            return self.logo_images

    def get_logo_images(self):
        '''space delimted list of tags'''
        if not self.logo_images:
            logog_images_ =  [self.root_url + "/img/logo/logo1.gif", self.root_url + "/img/logo/logo2.gif"]
            self.logo_images = [db.Category(logo_image.strip().encode('utf8')) for logo_image in logog_images_]
        return ' '.join([urllib.unquote(logo_image) for logo_image in self.logo_images])

    def set_logo_images(self, logo_images):
        if not logo_images:
            logo_images =  self.root_url + "/img/logo/logo1.gif " + self.root_url + "/img/logo/logo2.gif"
        self.logo_images = [db.Category(logo_image.strip().encode('utf8')) for logo_image in logo_images.split(' ')]

    logo_images_space = property(get_logo_images,set_logo_images)

class Portal(SerializableModel):
    body_size = db.StringProperty()
    sidebar = db.StringProperty()
    body_split = db.StringProperty()

class Portlet(SerializableModel):
    title = db.StringProperty(multiline=False)
    system_reserved = db.BooleanProperty(default = False)
    content = db.TextProperty()
    valid = db.BooleanProperty(default = False)

portlets_system_reserved = {
"Header":"../main_top.html",
"Footer":"../footer.html",
"albums":"http://picasaweb.google.com/data/feed/",
"blogger":"http://www.blogger.com/feeds/",
"base":"http://www.google.com/base/feeds/",
"site":"https://www.google.com/webmasters/tools/feeds/",
"spreadsheets":"http://spreadsheets.google.com/feeds/",
"codesearch":"http://www.google.com/codesearch/feeds/",
"finance":"http://finance.google.com/finance/feeds/",
"contacts":"http://www.google.com/m8/feeds/",
"youtube":"http://gdata.youtube.com/feeds/",
}

class User(EmailUser):
    fullname = db.StringProperty()
    username = db.StringProperty()
    country = db.StringProperty()
    birthday = db.DateTimeProperty()
    gender = db.StringProperty(multiline=False,choices=['M','F'])
    language = db.StringProperty()
    timezone = db.StringProperty()
    postcode = db.StringProperty()
    openids = db.ListProperty(db.Category)

    def get_nickname(self):
        return self.username

    def set_nickname(self,nickname):
        self.username = nickname

    def get_firstname(self):
        if self.fullname:
            return self.fullname.split(" ")[0]
        else:
            return ""

    def set_firstname(self,firstname):
        pass

    def get_lastname(self):
        if self.fullname:
            names =  self.fullname.split(" ")
            if(len(names)>1):
                return names[1]
        return ""

    def set_lastname(self,lastname):
        pass

    #make User object can be adaptable with google user object
    def nickname(self):
        return self.username

    nickname = property(get_nickname,set_nickname)
    firstname = property(get_firstname,set_firstname)
    lastname = property(get_lastname,set_lastname)


#User session will be control by cpedia.session.sessions
class UserSession(db.Model):
    """
    Model for the sessions in the datastore. This contains the identifier and
    validation information for the session.
    """
    sid = db.StringListProperty()
    ip = db.StringProperty()
    ua = db.StringProperty()
    last_activity = db.DateTimeProperty(auto_now=True)
    user = db.ReferenceProperty(User)   #refer to user.
    login = db.BooleanProperty(default = False) #whether user login or logout

#for store session data.
class UserSessionData(db.Model):
    """
    Model for the session data in the datastore.
    """
    session = db.ReferenceProperty(UserSession)
    keyname = db.StringProperty()
    content = db.BlobProperty()

class Album(SerializableModel):
    album_username = db.StringProperty()
    owner = db.UserProperty()
    date = db.DateTimeProperty(auto_now_add=True)
    access = db.StringProperty(multiline=False,default='public',choices=[
            'public','private','login'])     #public: all can access the album; private:only the owner can access;
    #login:login user can access.
    album_type = db.StringProperty(multiline=False,default='public',choices=[
            'public','private'])    #private album need to authorize by user and store the session token.
    order = db.IntegerProperty()
    valid = db.BooleanProperty(default = True)

class Menu(SerializableModel):
    title = db.StringProperty()
    permalink = db.StringProperty()
    target = db.StringProperty(multiline=False,default='_self',choices=[
            '_self','_blank','_parent','_top'])
    order = db.IntegerProperty()
    valid = db.BooleanProperty(default = True)

    def full_permalink(self):
        return  '/' + self.permalink

class Images(SerializableModel):
    uploader = db.UserProperty()
    image = db.BlobProperty()
    date = db.DateTimeProperty(auto_now_add=True)

class Feeds(SerializableModel):
    title = db.StringProperty()
    feed = db.StringProperty()
    order = db.IntegerProperty()
    valid = db.BooleanProperty(default = True)

class DeliciousPost(object):
    def __init__(self, item):
        self.link = item["u"]
        self.title = item["d"]
        self.description = item.get("n", "")
        self.tags = item["t"]

class CSSFile(SerializableModel):
    filename = db.StringProperty()
    contents = db.StringProperty(multiline=True)
    default = db.BooleanProperty(default=False)
    
