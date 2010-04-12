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

# -*- coding: utf-8 -*-

"""
translate.py

Translates strings using Google AJAX Language API

"""


import re
import sys
import urllib
import simplejson

from google.appengine.api import urlfetch


baseUrl = "http://ajax.googleapis.com/ajax/services/language/translate"

def getSplits(text,splitLength=4500):
    '''
    Translate Api has a limit on length of text(4500 characters) that can be translated at once,
    '''
    return (text[index:index+splitLength] for index in xrange(0,len(text),splitLength))



def translate(text, sl='', tl='en' ):
    '''
    A Python Wrapper for Google AJAX Language API:
    * Uses Google Language Detection, in cases source language is not provided with the source text
    * Splits up text if it's longer then 4500 characters, as a limit put up by the API
    '''

    retText=''
    for text in getSplits(text):      
            translated_page = urlfetch.fetch(
                url='%s' % (baseUrl),
                payload= urllib.urlencode(
                              {'langpair': '%s|%s' % (sl, tl),
                               'v': '1.0',
                               'ie': 'UTF8',
                               'q': text.encode('utf-8')}),
                method=urlfetch.POST,
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )

            if translated_page.status_code == 200:
                resp = simplejson.loads(translated_page.content)
                try:
                        retText += resp['responseData']['translatedText']
                except:
                        raise
    return retText