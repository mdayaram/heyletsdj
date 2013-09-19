import logging
import webapp2

import playlist


class Action(webapp2.RequestHandler):
    def post(self, action, playlist_id, session_id):
        pl = playlist.get(playlist_id)

        error_handler = lambda _: self.response.out.write('Action "%s" is unknown.' % action)
        try:
            {
                'channel': self.create_channel,
                'connect': self.connect,
                'disconnect': self.disconnect,
                'add': self.add,
                'upvote': self.upvote,
                'play': self.play,
                'pause': self.pause,
                'seek': self.seek,
                'stop': self.stop,
                'skip': self.skip,
            }.get(action, error_handler)(pl, session_id)
        except playlist.PlaylistError as e:
            self.response.write(e)

    def create_channel(self, pl, session_id):
        self.response.write(pl.create_channel(session_id))

    def connect(self, pl, session_id):
        client_id = self.request.get('clientId')
        pl.add_client(client_id, session_id)

    def disconnect(self, pl, _):
        client_id = self.request.get('clientId')
        pl.remove_client(client_id)

    def add(self, pl, session_id):
        video_id = self.request.get('videoId')
        allow_duplicates = self.request.get('allowDuplicates')
        if allow_duplicates == 'true':
            allow_duplicates = True
        elif allow_duplicates == 'false':
            allow_duplicates = False
        else:
            self.response.write('allowDuplicates must be a boolean.')
            return
        pl.add(video_id, allow_duplicates, session_id)

    def upvote(self, pl, session_id):
        entry_id = self.request.get('entryId')
        try:
            entry_id = int(entry_id)
            if not entry_id:
                raise ValueError()
        except ValueError:
            self.response.write('Entry "%s" does not exist.' % entry_id)
            return
        pl.upvote(entry_id, session_id)

    def play(self, pl, _):
        pl.play()

    def pause(self, pl, _):
        pl.pause()

    def seek(self, pl, _):
        seek_time = self.request.get('seekTime')
        try:
            seek_time = float(seek_time)
        except ValueError:
            self.response.write('seekTime "%s" is not a number.' % seek_time)
            return
        pl.seek(seek_time)

    def stop(self, pl, _):
        pl.stop()

    def skip(self, pl, _):
        entry_id = self.request.get('entryId')
        try:
            entry_id = int(entry_id)
            if not entry_id:
                raise ValueError()
        except ValueError:
            self.response.write('Entry "%s" does not exist.' % entry_id)
            return
        pl.skip(entry_id)
