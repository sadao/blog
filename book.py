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
import BeautifulSoup

__author__ = 'Ping Chen'

#import gdata.books
import gdata.books.service

import atom

import cgi
import wsgiref.handlers
import os
import re
import datetime
import calendar
import logging
import string

from BeautifulSoup import BeautifulSoup

from google.appengine.ext.webapp import template
from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext import db
from google.appengine.api import memcache
from google.appengine.api import urlfetch

import authorized
import view

import gdata.urlfetch
gdata.service.http_request_handler = gdata.urlfetch

class BaseRequestHandler(webapp.RequestHandler):
    def generate(self, template_name, template_values={}):
        values = {
        'request': self.request,
        }
        values.update(template_values)
        directory = os.path.dirname(__file__)
        view.ViewPage(cache_time=0).render(self, template_name,values)

class ProfileHandler(BaseRequestHandler):
    def get(self, username):
        key_ = "google_profile_"+username
        try:
            profile_content = memcache.get(key_)
        except Exception:
            profile_content = None
        if profile_content is None:
            url_="http://www.google.com/profiles/"+username
            profile_page = urlfetch.fetch(
                    url=url_,
                    method=urlfetch.GET,
                    headers={'Content-Type': 'text/html; charset=UTF-8'}
                    )
            if profile_page.status_code == 200:
                profile_html = BeautifulSoup(profile_page.content)
                #profile_html = profile_soap.find("html")
                line_divs = profile_html.findAll("div",attrs={"class":"gbh"})
                [line_div.extract() for line_div in line_divs]
                ft_divs = profile_html.findAll("div",attrs={"id":["ft","gbar","guser"]})
                [ft_div.extract() for ft_div in ft_divs]
                report_links = profile_html.findAll("a",attrs={"id":"reportprofilelink"})
                [report_link.extract() for report_link in report_links]
                images_ = profile_html.findAll("img")
                for image_ in images_:
                    image_url = image_.get("src")
                    if image_url and image_url.rfind("http:")==-1:
                        image_url = "http://www.google.com"+image_url
                        image_["src"] = image_url
                profile_content = profile_html.prettify()
                memcache.add(key=key_, value=profile_content, time=36000)
            else:
                template_values = {
                "username":username,
                "error":"Can not fetch the profile from Google, please check the profile url. \n"+url_
                }
                self.generate('google_profiles.html',template_values)
        template_values = {
        "username":username,
        "profile_content":profile_content
        }
        self.generate('google_profiles.html',template_values)

class BooksHandler(BaseRequestHandler):
    def get(self, userId):
        gd_client = gdata.books.service.BookService()
        key_books = "books_"+userId
        try:
            books = memcache.get(key_books)
        except Exception:
            books = None
        if not books:
            feed_books = gd_client.get_library(id=userId)
            books = []
            for book in feed_books:
                books+=[book]
            memcache.add(key=key_books, value=books, time=3600)
        template_values = {
        "userId":userId,
        "books":books,
        }
        self.generate('google_books.html',template_values)


