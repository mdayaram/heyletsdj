// YOUTUBE CROSSFADE LIBRARY 
// author: garencheckley@gmail.com -- 

// EXAMPLE IMPLIMENTATION
// ytcrossfade.init('ytplayer-container', ['OJBfv9CHlcw', 'vKNcuTWzTVw', 'OJBfv9CHlcw'], false);
// ytcrossfade.init('ytplayer-container', 'j2WWrupMBAE');

// Let's talk about methods!!
// ytcrossfade.init(containerId:String[, ytid(s):String or Array of strings, autoPlay:Boolean=True]);
// ytcrossfade.updateCrossfadeTime([crossfadeTime:Integer]);
// ytcrossfade.addVideoToPlaylist(ytid:String);
// ytcrossfade.loadAndPlayNext(ytid:String);
// ytcrossfade.getNowPlayingElementId();
// ytcrossfade.replacePlaylist(Array);
// ytcrossfade.immediatelyPlayVideo(ytid:String);
// ytcrossfadeWantsAnotherVideo() is called when it needs another
//   video added to the playlist to continue uninterrupted playback
// ytcrossfadeBeginningPlayback(ytid) is called when playback beings.
// ytcrossfadeOnPlayerStateChange(e) is called when the state changes of the 'Now Playing' player.
// ytcrossfadeDoneInit() is called when things are being done initing.
// ytcrossfade.getCurrentPlayer() returns the player object that is now playing.

document.write(
    "<style>#ytcrossfade-container-inner{position:relative;height:100%;width:100%}.ytcrossfade-player{position:absolute;width:100%;height:100%;opacity:0;-webkit-transition:opacity 8s}.ytcrossfade-player.ytcrossfade-nowPlaying{z-index:3;opacity:0.99}.ytcrossfade-player.ytcrossfade-upNext{z-index:2;opacity:0.01}</style>"
  );

// Namespace declaration.
ytcrossfade = {}

// Variable definitions.
ytcrossfade.CROSSFADE_TIME = 8; // Overlap / crossfade time, in seconds.
ytcrossfade.BUFFER_TIME = 8; // Time to buffer, in seconds.
ytcrossfade.yt_api_ready = false;
ytcrossfade.user_init_given = false;
ytcrossfade.initially_autoPlay = false;
ytcrossfade.player_a = false;
ytcrossfade.player_b = false;
ytcrossfade.player_a_dom = false;
ytcrossfade.player_b_dom = false;
ytcrossfade.nowPlayingYtid = false;
ytcrossfade.playlist = [];
ytcrossfade.volumeUpInterval = false;
ytcrossfade.volumeToMoveDownFrom = false;
ytcrossfade.volumeDownInterval = false;
ytcrossfade.stopVideoTimeout = false;
ytcrossfade.crossfadeStartime = false;
ytcrossfade.upNextLoaded = false;
ytcrossfade.timeInterval = false;
ytcrossfade.hasInit = false;

ytcrossfade.log = function(t) {
  console.log(t);
}


ytcrossfade.getCurrentPlayer = function() {
  // Capture the current objects.
  if  (document.getElementsByClassName('ytcrossfade-nowPlaying')[0].id.substring(19) == 'a') {
    return ytcrossfade.player_a;
  } else if (document.getElementsByClassName('ytcrossfade-nowPlaying')[0].id.substring(19) == 'b') {
    return ytcrossfade.player_b;
  }
}

ytcrossfade.playNext = function() {
  // Capture the current objects.
  if  (document.getElementsByClassName('ytcrossfade-nowPlaying')[0].id.substring(19) == 'a') {
    oldNowPlaying = ytcrossfade.player_a;
    oldNextUp = ytcrossfade.player_b;
  } else if (document.getElementsByClassName('ytcrossfade-nowPlaying')[0].id.substring(19) == 'b') {
    oldNowPlaying = ytcrossfade.player_b;
    oldNextUp = ytcrossfade.player_a;
  }

  ytcrossfade.log('playing next');
  try {ytcrossfadeBeginningPlayback(ytcrossfade.playlist[0]);}
  catch (err) {var t = 0;}


  ytcrossfade.crossfadeStartime = +new Date();
  // Start playing the next one and spinning up its volume.
    // If there is no video id to play next, then cancel.
    if (ytcrossfade.upNextLoaded == false) {
      if (ytcrossfade.playlist.length > 0) {
        var t = setTimeout( ytcrossfade.loadAndPlayNext(ytcrossfade.playlist[0]),  10);
        return 0;
      }
    }

    // Set the volume to 0.
    oldNextUp.setVolume(0);
    // Start the next one playing.
    oldNextUp.playVideo();
    // Spin up the volume.
    clearInterval( ytcrossfade.volumeUpInterval );
    ytcrossfade.volumeUpInterval = setInterval(
        function(){
          var now = +new Date;
          var diff = now - ytcrossfade.crossfadeStartime;
          var percentage = diff / (ytcrossfade.CROSSFADE_TIME * 1000);
          if (percentage >= 0.98) {
            // Make the volume top and clear this interval.
            oldNextUp.setVolume(100);
            clearInterval( ytcrossfade.volumeUpInterval )
          } else {
            var newVolume =  Math.round( percentage * 100 );
            oldNextUp.setVolume( newVolume );
          }
        },
        100
      );


  // Start spinning down the current one.
    // Spin the volume down.
    clearInterval( ytcrossfade.volumeDownInterval );
    ytcrossfade.volumeToMoveDownFrom = oldNowPlaying.getVolume();
    ytcrossfade.volumeDownInterval = setInterval(
        function(){
          var now = +new Date;
          var diff = now - ytcrossfade.crossfadeStartime;
          var percentage = diff / (ytcrossfade.CROSSFADE_TIME * 1000);
          if (percentage >= 0.98) {
            // Make the volume top and clear this interval.
            oldNowPlaying.setVolume(0);
            oldNowPlaying.stopVideo();
            oldNowPlaying.loadVideoById('___________');
            ytcrossfade.upNextLoaded = false;
            clearInterval( ytcrossfade.volumeDownInterval );
          } else {
            var newVolume = ytcrossfade.volumeToMoveDownFrom - Math.round( percentage * ytcrossfade.volumeToMoveDownFrom );
            oldNowPlaying.setVolume( newVolume );
          }
        },
        100
      );
    // After N time stop the current one.
    ytcrossfade.stopVideoTimeout = setTimeout(
        function(){oldNowPlaying.stopVideo();},
        ytcrossfade.CROSSFADE_TIME*1000
    );

  ytcrossfade.nowPlayingYtid = ytcrossfade.playlist.shift();

  ytcrossfade.swapShown();
}

ytcrossfade.playersReady = 0;
ytcrossfade.onPlayerReady = function(e) {
  // Test if now playing and if it should autoPlay.
  if ((e.target.a.className.indexOf('ytcrossfade-nowPlaying') > -1) &&
      (e.target.a.className.indexOf('ytcrossfade-uninit') > -1) &&
      (ytcrossfade.initially_autoPlay == true)) {
        ytcrossfade.initially_autoPlay == false;
        e.target.playVideo();
  }
  e.target.setVolume(100);
  clearInterval( ytcrossfade.timeInterval );
  ytcrossfade.timeInterval = setInterval(ytcrossfade.stopwatch,1000);
  e.target.a.className = e.target.a.className.replace('ytcrossfade-uninit','');
  ytcrossfade.playersReady += 1;
  if (ytcrossfade.playersReady == 2) {
    ytcrossfadeDoneInit();
    ytcrossfade.hasInit = true;
  }
  return 1;
}
ytcrossfade.onPlayerStateChange = function(e) {
  if (e.target.a.className.indexOf('ytcrossfade-nowPlaying') > -1) {
    ytcrossfadeOnPlayerStateChange(e);
    return 1;
  }
  return 0;
}


var player;
ytcrossfade.init = function(containerId, ytids, autoPlay) {
  ytcrossfade.user_init_given = true;
  if (typeof ytids == 'undefined') {
    ytcrossfade.nowPlayingYtid = '___________';
  } else if (typeof ytids == 'string') {
    // It's the first ytid to play.
    ytcrossfade.nowPlayingYtid = ytids;
    ytcrossfade.playlist = [];
  } else if (typeof ytids == 'object') {
    // It's an array probably.
    ytcrossfade.nowPlayingYtid = ytids.shift();
    ytcrossfade.playlist = ytids;
  }
  if (typeof autoPlay == 'undefined') {
    ytcrossfade.initially_autoPlay = true;
  } else {
    ytcrossfade.initially_autoPlay = autoPlay;
  }

  // Create two children of this container.
  document.getElementById(containerId).innerHTML = 
      '<div id=\'ytcrossfade-container-inner\'>' + 
        '<div id=\'ytcrossfade-player-a\'></div>' + 
        '<div id=\'ytcrossfade-player-b\'></div>' +
      '</div>';
  if (ytcrossfade.yt_api_ready) {
    ytcrossfade.init2();
  }
}
ytcrossfade.init2 = function() {

  if (ytcrossfade.user_init_given == false) {return 0;}

  if (ytcrossfade.yt_api_ready == false) {return 0;}

  // Add some css to these so they fill the container.
  var p = document.getElementById('ytcrossfade-container-inner');
  p.style.position = 'relative';
  ytcrossfade.player_a_dom = document.getElementById('ytcrossfade-player-a');
  ytcrossfade.player_b_dom = document.getElementById('ytcrossfade-player-b');
  ytcrossfade.player_a_dom.className += ' ytcrossfade-player ytcrossfade-nowPlaying ytcrossfade-uninit';
  ytcrossfade.player_b_dom.className += ' ytcrossfade-player ytcrossfade-nextUp ytcrossfade-uninit';

  ytcrossfade.player_a = new YT.Player('ytcrossfade-player-a', {
          height: '300',
          width: '300',
          videoId: ytcrossfade.nowPlayingYtid,
          events: {
            'onReady': ytcrossfade.onPlayerReady,
            'onStateChange': ytcrossfade.onPlayerStateChange
          },
          playerVars: {
            'autohide': 1,
            'iv_load_policy': 3
          }
        });
  ytcrossfade.player_b = new YT.Player('ytcrossfade-player-b', {
          height: '300',
          width: '300  ',
          videoId: '___________',
          events: {
            'onReady': ytcrossfade.onPlayerReady,
            'onStateChange': ytcrossfade.onPlayerStateChange
          },
          playerVars: {
            'autohide': 1,
            'iv_load_policy': 3
          }
        });
}

ytcrossfade.swapShown = function(toPromote) {
  if (typeof toPromote === 'undefined') {
    // Just swap the first one.
    toPromote = document.getElementsByClassName('ytcrossfade-nextUp')[0].id.substring(19);
  }
  // We want to promote the a player to the front.
  // Remove the current classes, and add the corrent ones.
  var a = document.getElementById('ytcrossfade-player-a');
  var b = document.getElementById('ytcrossfade-player-b');
  if (toPromote == 'a') {
    // The new nowPlaying will be player-a, and nextUp willl be player-b.
    a.className = a.className.replace('ytcrossfade-nextUp','');
    b.className = b.className.replace('ytcrossfade-nowPlaying','');
    a.className += ' ytcrossfade-nowPlaying';
    b.className += ' ytcrossfade-nextUp';
  } else if (toPromote == 'b') {
    // The new nowPlaying will be player-b, and nextUp willl be player-a.
    b.className = b.className.replace('ytcrossfade-nextUp','');
    a.className = a.className.replace('ytcrossfade-nowPlaying','');
    b.className += ' ytcrossfade-nowPlaying';
    a.className += ' ytcrossfade-nextUp'; 
  }
}

// ytcrossfade.loadNext('DwZVZ5qZnoA');
ytcrossfade.loadNext = function(ytid) {
  // Add to front of playlist.
  if ((typeof ytid != "undefined") && (ytcrossfade.playlist[0] != ytid)) {
    ytcrossfade.playlist.unshift( ytid );
  }
  if (typeof ytid === "undefined") {
    ytid = ytcrossfade.playlist[0];
  }
  if (document.getElementsByClassName('ytcrossfade-nowPlaying')[0].id.substring(19) == 'a') {
    nextUp = ytcrossfade.player_b;
  } else if (document.getElementsByClassName('ytcrossfade-nowPlaying')[0].id.substring(19) == 'b') {
    nextUp = ytcrossfade.player_a;
  }
  nextUp.loadVideoById(ytid);
  nextUp.setVolume(0);
  nextUp.seekTo(0.3, true);
  nextUp.stopVideo();
  ytcrossfade.upNextLoaded = true;
  return 1;
}

// ytcrossfade.loadAndPlayNext('DwZVZ5qZnoA');
ytcrossfade.loadAndPlayNext = function(ytid) {
  var trash = ytcrossfade.loadNext(ytid);
  ytcrossfade.playNext();
}

// The function that automatically loads new videos, and switches to the next video.
ytcrossfade.stopwatch = function() {
  if  (document.getElementsByClassName('ytcrossfade-nowPlaying')[0].id.substring(19) == 'a') {
    nowPlaying = ytcrossfade.player_a;
  } else if (document.getElementsByClassName('ytcrossfade-nowPlaying')[0].id.substring(19) == 'b') {
    nowPlaying = ytcrossfade.player_b;
  }
  if (nowPlaying.getPlayerState() != 1) {
    // It isn't playing.
    return 0;
  }
  var remaining = nowPlaying.getDuration() - nowPlaying.getCurrentTime();
  
  if ((remaining < ytcrossfade.CROSSFADE_TIME + ytcrossfade.BUFFER_TIME * 2)
      && (ytcrossfade.upNextLoaded == false)
      && (ytcrossfade.playlist.length == 0)) {
    ytcrossfadeWantsAnotherVideo();
  } else if ((remaining < ytcrossfade.CROSSFADE_TIME + ytcrossfade.BUFFER_TIME)
      && (ytcrossfade.upNextLoaded == false)
      && (ytcrossfade.playlist.length > 0)) {
    ytcrossfade.loadNext();
  } else if ((remaining < ytcrossfade.CROSSFADE_TIME)
      && (ytcrossfade.upNextLoaded == true)) {
    ytcrossfade.log('starting a playNext');
    ytcrossfade.playNext();
  }
}

ytcrossfade.addVideoToPlaylist = function(ytid) {
  if (ytcrossfade.playlist.indexOf(ytid) == -1) {
    ytcrossfade.playlist.push(ytid);
    return 1;
  } else {
    return 0;
  }
}

ytcrossfade.replacePlaylist = function(newPlaylist) {
  if (typeof newPlaylist == 'object') {
    ytcrossfade.playlist = newPlaylist;
    return 1;
  } else {
    return 0;
  }
}

ytcrossfade.immediatelyPlayVideo = function(ytid) {
  if  (document.getElementsByClassName('ytcrossfade-nowPlaying')[0].id.substring(19) == 'a') {
    nowPlaying = ytcrossfade.player_a;
  } else if (document.getElementsByClassName('ytcrossfade-nowPlaying')[0].id.substring(19) == 'b') {
    nowPlaying = ytcrossfade.player_b;
  }
  nowPlaying.loadVideoById(ytid);
  nowPlaying.setVolume(100);
  ytcrossfade.nowPlayingYtid = ytid;
}

ytcrossfade.updateCrossfadeTime = function(seconds) {
  ytcrossfade.CROSSFADE_TIME = seconds;
  var newValue = 'opacity '+seconds+'s';
  document.getElementById('ytcrossfade-player-a').style.WebkitTransition = newValue;
  document.getElementById('ytcrossfade-player-a').style.MozTransition = newValue;
  document.getElementById('ytcrossfade-player-b').style.WebkitTransition = newValue;
  document.getElementById('ytcrossfade-player-b').style.MozTransition = newValue;
}

ytcrossfade.getNowPlayingElementId = function() {
  return document.getElementsByClassName('ytcrossfade-nowPlaying')[0].id;
}

function onYouTubeIframeAPIReady() {
  ytcrossfade.yt_api_ready = true;
  ytcrossfade.init2();
}

// From YouTube, initialize the HTML5 iframe API.
// https://developers.google.com/youtube/iframe_api_reference
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
