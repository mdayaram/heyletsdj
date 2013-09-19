import logging
import uuid
import webapp2

from webapp2_extras import sessions


class SessionRequestHandler(webapp2.RequestHandler):
    def dispatch(self):
        self.__session_store = sessions.get_store()
        if not self.session.get('id'):
          self.session['id'] = uuid.uuid4().hex

        try:
            super(SessionRequestHandler, self).dispatch()
        finally:
            self.__session_store.save_sessions(self.response)

    @webapp2.cached_property
    def session(self):
        return self.__session_store.get_session()
