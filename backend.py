#!/usr/bin/env python
import logging
import os
import webapp2

import action


config = {}


app = webapp2.WSGIApplication(
    [('/action/(\w+)/(\w+)/(\w+)/?', action.Action)],
    config=config,
    debug=os.environ.get('SERVER_SOFTWARE', '').startswith('Dev'))
