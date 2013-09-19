window.performance = window.performance || {};
performance.now = (function() {
  return performance.now       ||
         performance.mozNow    ||
         performance.msNow     ||
         performance.oNow      ||
         performance.webkitNow ||
         function() { return new Date().getTime(); };
})();

function HeyLetsDj(id) {
  this.id = id;
  this.seekTime = null;
  this.startTime = null;
  this.status = null;
  this.playlist = null;
}

HeyLetsDj.prototype.start = function() {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = (function() {
    if (xhr.readyState != 4)
      return;

    if (xhr.status == 200 && xhr.responseText) {
      goog.appengine.Socket.POLLING_TIMEOUT_MS = 100;
      var channel = new goog.appengine.Channel(xhr.responseText);
      var socket = channel.open();
      socket.onclose = this.onClose.bind(this);
      socket.onmessage = this.onMessage.bind(this);
    } else {
      setTimeout(this.start.bind(this), 4000);
    }
  }).bind(this);
  var path = '/' + this.id + '/channel';
  xhr.open('POST', path, true);
  xhr.send();
};

HeyLetsDj.prototype.onClose = function() {
  this.start();
};

HeyLetsDj.prototype.onMessage = function(message) {
  data = JSON.parse(message.data);
  switch (data.event) {
    case 'refresh':
      var playlistInfo = data.playlistInfo;
      this.playlist = playlistInfo.entries;
      this.updatePlayer(playlistInfo.seekTime, playlistInfo.status);
      if (typeof this.onPlaylistUpdate != 'undefined')
        this.onPlaylistUpdate();
      if (typeof this.onRefresh != 'undefined')
        this.onRefresh(playlistInfo);
      break;
    case 'add':
      this.playlist.splice(data.rank, 0, data.entryInfo);
      if (typeof this.onPlaylistUpdate != 'undefined')
        this.onPlaylistUpdate();
      if (typeof this.onAdd != 'undefined')
        this.onAdd(data.entryInfo, data.rank);
      break;
    case 'upvote':
      this.playlist[data.oldRank].voteCount = data.voteCount;
      this.playlist[data.oldRank].voted = data.voted;
      this.playlist.splice(data.newRank, 0, this.playlist.splice(data.oldRank, 1)[0]);
      if (typeof this.onPlaylistUpdate != 'undefined')
        this.onPlaylistUpdate();
      if (typeof this.onUpvote != 'undefined')
        this.onUpvote(data.entryId, data.voteCount, data.voted, data.oldRank, data.newRank);
      break;
    case 'play':
      this.updatePlayer(data.seekTime, 'playing');
      if (typeof this.onPlay != 'undefined')
        this.onPlay(data.seekTime);
      break;
    case 'pause':
      this.updatePlayer(data.seekTime, 'paused');
      if (typeof this.onPause != 'undefined')
        this.onPause(data.seekTime);
      break;
    case 'seek':
      this.updatePlayer(data.seekTime);
      if (typeof this.onSeek != 'undefined')
        this.onSeek(data.seekTime);
      break;
    case 'stop':
      this.updatePlayer(0., 'stopped');
      if (typeof this.onStop != 'undefined')
        this.onStop();
      break;
    case 'next':
      this.playlist[0].voteCount = 0;
      this.playlist[0].voted = false;
      this.playlist.push(this.playlist.shift());
      this.updatePlayer(0.);
      if (typeof this.onPlaylistUpdate != 'undefined')
        this.onPlaylistUpdate();
      if (typeof this.onNext != 'undefined')
        this.onNext(data.crossfadeDuration);
      break;
  }
};

HeyLetsDj.prototype.updatePlayer = function(seekTime, opt_status) {
  this.seekTime = seekTime;
  this.startTime = performance.now();
  if (typeof opt_status != 'undefined')
    this.status = opt_status;
  if (typeof this.onPlayerUpdate != 'undefined')
    this.onPlayerUpdate(seekTime, opt_status);
};

HeyLetsDj.prototype.getSeekTime = function() {
  switch (this.status) {
    case 'stopped':
      return 0.;
    case 'playing':
      return this.seekTime + (performance.now() - this.startTime) / 1000;
    case 'paused':
      return this.seekTime;
    default:
      console.error('Unknown playlist status: ' + this.status + '.')
  }
};

HeyLetsDj.prototype.add = function(videoId, opt_allowDuplicates) {
  this.sendRequest('add', { videoId: videoId,
                            allowDuplicates: Boolean(opt_allowDuplicates) });
};

HeyLetsDj.prototype.upvote = function(entryId) {
  this.sendRequest('upvote', { entryId: entryId });
};

HeyLetsDj.prototype.play = function() {
  this.sendRequest('play');
};

HeyLetsDj.prototype.pause = function() {
  this.sendRequest('pause');
};

HeyLetsDj.prototype.seek = function(seekTime) {
  this.sendRequest('seek', { seekTime: seekTime });
};

HeyLetsDj.prototype.stop = function() {
  this.sendRequest('stop');
};

HeyLetsDj.prototype.skip = function() {
  this.sendRequest('skip', { entryId: this.playlist[0].id });
};

HeyLetsDj.prototype.sendRequest = function(method, opt_arguments) {
  var path = '/' + this.id + '/' + method;
  if (opt_arguments) {
    path += '?';
    var argumentList = [];
    for (argName in opt_arguments)
      argumentList.push(argName + '=' + opt_arguments[argName]);
    path += argumentList.join('&');
  }
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4 && xhr.responseText) {
      console.error('Request failed: ' + method + '(' + JSON.stringify(opt_arguments) + ')');
      console.error(xhr.responseText);
    }
  }
  xhr.open('POST', path, true);
  xhr.send();
};
