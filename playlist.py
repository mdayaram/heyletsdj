import datetime
import json
import logging
import threading
import uuid

from google.appengine.api import background_thread
from google.appengine.api import channel
from google.appengine.api import memcache
from google.appengine.api import urlfetch
from google.appengine.ext import db


CROSSFADE_DURATION_SECONDS = 1


class PlaylistError(Exception):
    pass


class PlaylistEmptyError(PlaylistError):
    def __init__(self, playlist_id):
        super(PlaylistEmptyError, self).__init__(
                'Playlist "%s" has no videos.' % playlist_id)


class AlreadyPlayingError(PlaylistError):
    def __init__(self, playlist_id):
        super(AlreadyPlayingError, self).__init__(
                'Playlist "%s" is already playing.' % playlist_id)


class NotPlayingError(PlaylistError):
    def __init__(self, playlist_id):
        super(NotPlayingError, self).__init__(
                'Playlist "%s" is not playing.' % playlist_id)


class NonexistentEntryError(PlaylistError):
    def __init__(self, entry_id):
        super(NonexistentEntryError, self).__init__(
                'Playlist entry "%s" does not exist.' % entry_id)


class AlreadyVotedError(PlaylistError):
    def __init__(self, entry_id):
        super(AlreadyVotedError, self).__init__(
                'Already voted for entry "%s".' % entry_id)


class WrongEntryError(PlaylistError):
    def __init__(self, entry_id):
        super(WrongEntryError, self).__init__(
                'Playlist entry "%s" is not currently skippable.' % entry_id)


class NonexistentVideoError(PlaylistError):
    def __init__(self, video_id):
        super(NonexistentVideoError, self).__init__(
                'Video "%s" does not exist.' % video_id)


class DuplicateVideoError(PlaylistError):
    def __init__(self, video_id):
        super(DuplicateVideoError, self).__init__(
                'Video "%s" is already in the playlist.' % video_id)


class Status(object):
    Stopped, Playing, Paused = range(3)


class PlaylistEntry(db.Model):
    video_id = db.StringProperty(required=True)
    title = db.StringProperty(required=True)
    duration = db.IntegerProperty(required=True)
    vote_count = db.IntegerProperty(default=1, required=True)
    voters = db.StringListProperty()

    @classmethod
    def create(cls, video_id, title, duration, session_id):
        entry = cls(video_id=video_id, title=title, duration=duration, voters=[session_id])
        entry.put()
        return entry

    @staticmethod
    def key_comparator(key1, key2):
        return int(PlaylistEntry.get(key2).vote_count -
            PlaylistEntry.get(key1).vote_count)

    def voted(self, session_id):
        return session_id in self.voters

    def get_info(self, session_id):
        return {
            'id': self.key().id(),
            'videoId': self.video_id,
            'title': self.title,
            'duration': self.duration,
            'voteCount': self.vote_count,
            'voted': self.voted(session_id),
        }

    def upvote(self, session_id):
        self.vote_count += 1
        self.voters.append(session_id)
        self.put()

    def reset_votes(self):
        self.vote_count = 0
        self.voters = []
        self.put()



def get(playlist_id):
    playlist = memcache.get(playlist_id)
    if not playlist:
        playlist = Playlist.get_or_insert(playlist_id)
        playlist._clients = {}
        memcache.add(playlist_id, playlist)
    return playlist


def _get_video_info(video_id):
    youtube_video_url = 'http://gdata.youtube.com/feeds/api/videos/%s?alt=json' % video_id
    response = urlfetch.fetch(youtube_video_url)
    if response.status_code == 400 and response.content == 'Invalid id':
        raise NonexistentVideoError(video_id)
    if response.status_code != 200:
        raise Exception('YouTube returned %s\n%s' % (response.status_code, response.content))
    try:
        video_data = json.loads(response.content)
    except ValueError:
        raise Exception('YouTube returned %s\n%s' % (response.status_code, response.content))
    info = {}
    info['title'] = video_data['entry']['media$group']['media$title']['$t']
    info['duration'] = int(video_data['entry']['media$group']['yt$duration']['seconds'])
    return info


_play_timers = {}


class Playlist(db.Model):
    _playlists = {}

    seek_time = db.FloatProperty(default=0., required=True)
    start_time = db.DateTimeProperty()
    status = db.IntegerProperty(default=Status.Stopped, required=True)
    playing = db.ReferenceProperty(PlaylistEntry)
    entries = db.ListProperty(db.Key)

    def create_channel(self, session_id):
        client_id = '.'.join([self.key().name(), session_id, uuid.uuid4().hex])
        channel_token = channel.create_channel(client_id)
        return channel_token

    def add_client(self, client_id, session_id):
        self._clients[client_id] = session_id
        memcache.set(self.key().name(), self)
        self._send_message(
            client_id,
            {'event': 'refresh',
             'playlistInfo': self.get_info(session_id)})

    def remove_client(self, client_id):
        if client_id in self._clients:
            del self._clients[client_id]
            memcache.set(self.key().name(), self)

    def get_info(self, session_id):
        def get_entry_info(entry_key):
            return PlaylistEntry.get(entry_key).get_info(session_id)

        return {'id': self.key().name(),
                'status': self._get_status_string(),
                'seekTime': self._get_seek_time(),
                'entries': map(get_entry_info, self.entries),
               }

    def add(self, video_id, allow_duplicates, session_id):
        def video_in_playlist():
            for entry_key in self.entries:
                if video_id == PlaylistEntry.get(entry_key).video_id:
                    return True
            return False
        if not allow_duplicates and video_in_playlist():
            raise DuplicateVideoError(video_id)

        video_info = _get_video_info(video_id)
        entry = PlaylistEntry.create(
                video_id, video_info['title'], video_info['duration'], session_id)

        self.entries.append(entry.key())
        self.entries.sort(PlaylistEntry.key_comparator)
        memcache.set(self.key().name(), self)
        self.put()

        for client, session_id in self._clients.iteritems():
            self._send_message(
                client,
                {'event': 'add',
                 'entryInfo': entry.get_info(session_id),
                 'rank': self.entries.index(entry.key())})

    def upvote(self, entry_id, session_id):
        entry = PlaylistEntry.get_by_id(entry_id)
        if not (entry and entry.key() in self.entries):
            raise NonexistentEntryError(entry_id)
        if session_id in entry.voters:
            raise AlreadyVotedError(entry_id)
        entry.upvote(session_id)

        old_rank = self.entries.index(entry.key())
        self.entries.remove(entry.key())
        self.entries.insert(0, entry.key())
        self.entries.sort(PlaylistEntry.key_comparator)
        memcache.set(self.key().name(), self)
        self.put()
        new_rank = self.entries.index(entry.key())

        for client, session_id in self._clients.iteritems():
            self._send_message(
                client,
                {'event': 'upvote',
                 'entryId': entry_id,
                 'voteCount': entry.vote_count,
                 'voted': entry.voted(session_id),
                 'oldRank': old_rank,
                 'newRank': new_rank})

    def play(self):
        if self._is_empty():
            raise PlaylistEmptyError(self.key().name())
        if self.status == Status.Playing:
            raise AlreadyPlayingError(self.key().name())

        self.start_time = datetime.datetime.now()
        self.status = Status.Playing
        memcache.set(self.key().name(), self)
        self.put()

        self._start_next_timer()

        self._broadcast({'event': 'play',
                         'seekTime': self._get_seek_time()})

    def pause(self):
        if self._is_empty():
            raise PlaylistEmptyError(self.key().name())
        if self.status != Status.Playing:
            raise NotPlayingError(self.key().name())

        self.seek_time = self._get_seek_time()
        self.start_time = datetime.datetime.now()
        self.status = Status.Paused
        memcache.set(self.key().name(), self)
        self.put()

        self._cancel_next_timer()

        self._broadcast({'event': 'pause',
                         'seekTime': self._get_seek_time()})

    def _seek(self, seek_time):
        self.seek_time = seek_time
        self.start_time = datetime.datetime.now()

    def seek(self, seek_time):
        if self._is_empty():
            raise PlaylistEmptyError(self.key().name())
        if self.status == Status.Stopped:
            raise NotPlayingError(self.key().name())

        self._seek(seek_time)
        memcache.set(self.key().name(), self)
        self.put()

        self._cancel_next_timer()
        self._start_next_timer()

        self._broadcast({'event': 'seek',
                         'seekTime': self._get_seek_time()})

    def stop(self):
        if self._is_empty():
            raise PlaylistEmptyError(self.key().name())
        if self.status == Status.Stopped:
            raise NotPlayingError(self.key().name())

        self.seek_time = 0.
        self.start_time = None
        self.status = Status.Stopped
        memcache.set(self.key().name(), self)
        self.put()

        self._cancel_next_timer()

        self._broadcast({'event': 'stop'})

    def skip(self, entry_id):
        if self._is_empty():
            raise PlaylistEmptyError(self.key().name())
        entry = PlaylistEntry.get_by_id(entry_id)
        if not (entry and entry.key() in self.entries):
            raise NonexistentEntryError(entry_id)
        if entry.key() != self.entries[0]:
            raise WrongEntryError(entry_id)
        self._next()

    def _next(self):
        PlaylistEntry.get(self.entries[0]).reset_votes()

        self._seek(0.)
        self.entries.append(self.entries.pop(0))
        memcache.set(self.key().name(), self)
        self.put()

        self._start_next_timer()

        self._broadcast({'event': 'next',
                         'crossfadeDuration': CROSSFADE_DURATION_SECONDS})

    def _start_next_timer(self):
        time_left = (PlaylistEntry.get(self.entries[0]).duration - 
            self._get_seek_time() - CROSSFADE_DURATION_SECONDS)
        play_timer = threading.Timer(time_left, self._next)
        _play_timers[self.key().name()] = play_timer
        background_thread.start_new_background_thread(play_timer.start, [])

    def _cancel_next_timer(self):
        _play_timers[self.key().name()].cancel()
        del _play_timers[self.key().name()]

    def _is_empty(self):
        return not self.entries

    def _get_seek_time(self):
        if self.status == Status.Playing:
            elapsed_seconds = (datetime.datetime.now() - self.start_time).total_seconds()
        else:
            elapsed_seconds = 0
        return self.seek_time + elapsed_seconds

    def _get_status_string(self):
        return {
            Status.Stopped: 'stopped',
            Status.Playing: 'playing',
            Status.Paused: 'paused',
        }[self.status]

    @staticmethod
    def _send_message(client, message):
        channel.send_message(client, json.dumps(message))

    def _broadcast(self, message):
        for client in self._clients:
            self._send_message(client, message)
