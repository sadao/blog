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


import gdata.photos.service
import gdata.media
import gdata.geo
import atom

import cgi
import wsgiref.handlers
import os
import re
import datetime
import time
import calendar
import logging
import string

from xml.etree import ElementTree

from google.appengine.ext.webapp import template
from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext import db
from google.appengine.api import memcache

from model import Archive,Weblog,WeblogReactions,\
    AuthSubStoredToken,Album,Menu,Images,Tag,Feeds,CPediaLog,User
import cpedia.sessions.sessions
import authorized
import view
import util

import gdata.urlfetch
gdata.service.http_request_handler = gdata.urlfetch

class BaseRequestHandler(webapp.RequestHandler):
  session = cpedia.sessions.sessions.Session()
  def generate(self, template_name, template_values={}):
    values = {
      'request': self.request,
      'stylesheets' : util.getCSS()
    }
    values.update(template_values)
    directory = os.path.dirname(__file__)
    view.ViewPage(cache_time=0).render(self, template_name,values)

class MainPage(BaseRequestHandler):
  @authorized.role('admin')
  def get(self):
        template_values = {
          }
        self.generate('admin_main.html',template_values)


class AdminAuthsubPage(BaseRequestHandler):
  @authorized.role('admin')
  def get(self):
        session_tokens = AuthSubStoredToken.all()
        template_values = {
          'session_tokens':session_tokens,
          }
        self.generate('admin/admin_authsub.html',template_values)


class AdminCachePage(BaseRequestHandler):
  @authorized.role('admin')
  def get(self):
        cache_stats = memcache.get_stats()
        template_values = {
          'cache_stats':cache_stats,
          }
        self.generate('admin/admin_cache.html',template_values)


class AdminSystemPage(BaseRequestHandler):
  @authorized.role('admin')
  def get(self):
        template_values = {
          }
        self.generate('admin/admin_system.html',template_values)

  @authorized.role('admin')
  def post(self):
        cpedialog = util.getCPedialog()
        cpedialog.title = self.request.get("title")
        cpedialog.author = self.request.get("author")
        cpedialog.email = users.GetCurrentUser().email()
        cpedialog.root_url = self.request.get("root_url")
        cpedialog.description = self.request.get("description")
        cpedialog.logo_images_space = self.request.get("logo_images_space")
        if(int(self.request.get("num_post_per_page"))!=cpedialog.num_post_per_page):
            cpedialog.num_post_per_page = int(self.request.get("num_post_per_page"))
            util.flushBlogPagesCache()        
        cpedialog.cache_time = int(self.request.get("cache_time"))
        if self.request.get("debug"):
            cpedialog.debug = True
        else:
            cpedialog.debug = False
        cpedialog.host_ip = self.request.remote_addr
        cpedialog.host_domain = self.request.get("SERVER_NAME")
        cpedialog.time_zone_offset = float(self.request.get("time_zone_offset"))
        if self.request.get("recaptcha_enable"):
            cpedialog.recaptcha_enable = True
            cpedialog.recaptcha_public_key =  self.request.get("recaptcha_public_key")
            cpedialog.recaptcha_private_key =  self.request.get("recaptcha_private_key")
        else:
            cpedialog.recaptcha_enable = False
            
        if self.request.get("delicious_enable"):
            cpedialog.delicious_enable = True
            if(self.request.get("delicious_username")!=cpedialog.delicious_username):
                cpedialog.delicious_username =  self.request.get("delicious_username")
                util.flushDeliciousTag()
        else:
            cpedialog.delicious_enable = False

        if self.request.get("analytics_enable"):
            cpedialog.analytics_enable = True
            cpedialog.analytics_web_property_id =  self.request.get("analytics_web_property_id")
        else:
            cpedialog.analytics_enable = False

        if self.request.get("google_ajax_feed_enable"):
            cpedialog.google_ajax_feed_enable = True
            cpedialog.google_ajax_feed_title =  self.request.get("google_ajax_feed_title")
            cpedialog.google_ajax_feed_result_num = int(self.request.get("google_ajax_feed_result_num"))
        else:
            cpedialog.google_ajax_feed_enable = False

        if self.request.get("show_description"):
            cpedialog.description_next_logo = True
        else:
            cpedialog.description_next_logo = False

        custom_logo_url = self.request.get("custom_logo_url")
        custom_logo = self.request.get("custom_logo")
        if custom_logo_url:
            cpedialog.site_logo = custom_logo_url
        elif custom_logo:
            images = Images()
            images.image = db.Blob(custom_logo)
            images.uploader = users.GetCurrentUser()
            key = images.put()
            cpedialog.site_logo = "/rpc/img?img_id=%s" % (key)

        cpedialog.put()
        util.flushCPedialog()
        self.redirect('/admin')
        return

class AdminPagesPage(BaseRequestHandler):
  @authorized.role('admin')
  def get(self):
        pages = Weblog.all().filter('entrytype','page').order('-date')
        #menus = Menu.all().order('order')
        template_values = {
            'pages':pages,
           # 'menus':menus,
          }
        self.generate('admin/admin_pages.html',template_values)


class AdminAlbumsPage(BaseRequestHandler):
  @authorized.role('admin')
  def get(self):
        albums = Album.all().order('order')
        template_values = {
            'albums':albums,
          }
        self.generate('admin/admin_albums.html',template_values)

        
class AdminFeedsPage(BaseRequestHandler):
  @authorized.role('admin')
  def get(self):
        feeds = Feeds.all().order('order')
        template_values = {
            'feeds':feeds,
          }
        self.generate('admin/admin_feeds.html',template_values)


class AdminImagesPage(BaseRequestHandler):
  @authorized.role('admin')
  def get(self):
        template_values = {
          }
        self.generate('admin/admin_images.html',template_values)

class AdminCSSPage(BaseRequestHandler):
  @authorized.role('admin')
  def get(self):
        template_values = {
          }
        self.generate('admin/admin_css.html',template_values)

class AdminTagsPage(BaseRequestHandler):
  @authorized.role('admin')
  def get(self):
        tags = Tag.all().order('-entrycount')
        template_values = {
           'tags':tags,
          }
        self.generate('admin/admin_tags.html',template_values)


class AdminArchivesPage(BaseRequestHandler):
  @authorized.role('admin')
  def get(self):
        archives = Archive.all().order('-date')
        template_values = {
          'archives':archives,
          }
        self.generate('admin/admin_archives.html',template_values)

        
class AdminLayoutPage(BaseRequestHandler):
  @authorized.role('admin')
  def get(self):
      pageStr = self.request.get('page')
      if pageStr:
          page = int(pageStr)
      else:
          page = 1;

      #get blog pagination from cache.
      obj_page = util.getBlogPagination(page)
      if obj_page is None:
          self.redirect('/')
          return
      recentReactions = util.getRecentReactions()
      template_values = {
        'page':obj_page,
        'recentReactions':recentReactions,
        }
      self.generate('admin/admin_layout.html',template_values)

