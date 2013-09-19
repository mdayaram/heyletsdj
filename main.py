#!/usr/bin/env python
import logging
import os
import webapp2

import page


config = {}
config['webapp2_extras.sessions'] = {
    'secret_key': 'hey-lets-dj-secret-key',
}


app = webapp2.WSGIApplication(
    [('/(\w+)/?', page.PlaylistPage),
     ('/(\w+)/player/?', page.PlayerPage),
     ('/(\w+)/test/?', page.TestPage),
     ('/(\w+)/(\w+)/?', page.ActionHandler),
     ('/_ah/channel/connected/', page.ChannelConnectHandler),
     ('/_ah/channel/disconnected/', page.ChannelDisconnectHandler)],
    config=config,
    debug=os.environ.get('SERVER_SOFTWARE', '').startswith('Dev'))
