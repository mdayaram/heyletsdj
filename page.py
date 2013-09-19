import logging
import os
import webapp2

from google.appengine.api import backends
from google.appengine.api import urlfetch
from google.appengine.ext.webapp import template

import session


def _apply_template(page_filename, context):
    template_path = os.path.join(os.path.dirname(__file__), page_filename)
    return template.render(template_path, context)


def _backend_request(action, playlist_id, session_id, parameters):
    base_url = backends.get_url('playlist')
    action_url = ('%s/action/%s/%s/%s?%s' %
        (base_url, action, playlist_id, session_id, parameters))
    response = urlfetch.fetch(action_url, method=urlfetch.POST)
    return response.content


class PlaylistPage(webapp2.RequestHandler):
    def get(self, playlist_id):
        context = {'playlistId': playlist_id}
        self.response.out.write(_apply_template('playlist.html', context))


class PlayerPage(webapp2.RequestHandler):
    def get(self, playlist_id):
        context = {'playlistId': playlist_id}
        self.response.out.write(_apply_template('player.html', context))


class TestPage(webapp2.RequestHandler):
    def get(self, playlist_id):
        context = {'playlistId': playlist_id}
        self.response.out.write(_apply_template('test.html', context))


class ActionHandler(session.SessionRequestHandler):
    def post(self, playlist_id, action):
        session_id = self.session['id']
        parameters = self.request.query_string
        response = _backend_request(action, playlist_id, session_id, parameters)
        self.response.out.write(response)


class ChannelConnectHandler(webapp2.RequestHandler):
    def post(self):
        client_id = self.request.get('from')
        playlist_id, session_id, _ = client_id.split('.')
        parameters = 'clientId=%s' % client_id
        response = _backend_request('connect', playlist_id, session_id, parameters)
        self.response.out.write(response)


class ChannelDisconnectHandler(webapp2.RequestHandler):
    def post(self):
        client_id = self.request.get('from')
        playlist_id, session_id, _ = client_id.split('.')
        parameters = 'clientId=%s' % client_id
        response = _backend_request('disconnect', playlist_id, session_id, parameters)
        self.response.out.write(response)
