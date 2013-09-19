
function log(a) {
  console.log(a);
}


var addButton   = $("#add-button");
var addButtonOffset = addButton.offset();

function refreshAddFixedScrollStuff() {
  addButton   = $("#add-button");
  addButtonOffset = addButton.offset();
}
$(window).scroll(function() {
  if ($(window).scrollTop() > addButtonOffset.top + 8) {
      $('#add-button-container').addClass('fixed');
  } else {
      $('#add-button-container').removeClass('fixed');
  }
});

function togglePlaylistAdd() {
  // $('body').toggleClass('adding').toggleClass('playlist');
  if ($('body').hasClass('playlist')) {
    $('body').removeClass('playlist').addClass('adding');
    // Scoll to the top.
    // Clear.
    $('#search-result-label').html( '' );
    $('#search-instructions').html( 'Similar Videos' );
    $('#search-loading-text').hide().html( '' );
    $('#search-results').html( suggestionLinks() );
    $('#search-input').val('');
    linkifyEverything();
    collapseSearchUi();
    $('html,body').animate({scrollTop:0},0);
  } else if ($('body').hasClass('adding')) {
    $('body').removeClass('adding').addClass('playlist');
    // Scroll somewhere.
    var trash2 = setTimeout( scrollMe, 100 );
  }
}

var lastQuery = false;
var xhr = false;
function updateYoutubeSearch() {
  var query = $('#search-input').val();
  if ((query == lastQuery) && (query == '')) {return 0;}
  lastQuery = query;
  $('#search-result-label').html( '' );
  $('#search-instructions').html( '' );
  $('#search-loading-text').show().html( 'searching for <em>'+query+'</em>' );
  $('#search-results').html('');
  performYoutubeQuery(query, 'organic');
}
function searchRelated(ytid, title) {
  performYoutubeQuery(ytid, 'related', title);
  $('#search-result-label').html( '' );
  $('#search-instructions').html( '' );
  $('#search-loading-text').show().html( 'searching for videos related to <em>'+title+'</em>' );
  $('#search-results').html('');
}

function secondsToHms(d) {
  d = Number(d);
  var h = Math.floor(d / 3600);
  var m = Math.floor(d % 3600 / 60);
  var s = Math.floor(d % 3600 % 60);
  return ((h > 0 ? h + ":" : "") + (m > 0 ? (h > 0 && m < 10 ? "0" : "") + m + ":" : "0:") + (s < 10 ? "0" : "") + s);
}

function searchResultHtml(video, type) { // type should be 'new' or 'in-playlist'
  var ytid = video.id.$t.substring(video.id.$t.length-11);
  var title = video.title.$t;
  var uploader = video.author[0].name.$t;
  var length = video.media$group.yt$duration.seconds;
  var html = '<li class="video-item ';
  if (type == 'new') {
    html += 'add';
  } else if (type == 'in-playlist') {
    if ( hasVoted( ytid ) ) {
      html += "voted";
    } else {
      html += 'up';
    }
  }
  html += '" data-ytid="'+ytid+'"';
  html += 'data-title="'+title+'"';
  html += 'data-uploader="'+uploader+'"';
  html += 'data-length="'+length+'">';
  html += '<div class="thumbnail-container"><img src="http://img.youtube.com/vi/'+ytid+'/hqdefault.jpg" class="thumbnail" /></div>';
  // html += '<img src="http://img.youtube.com/vi/'+ytid+'/hqdefault.jpg" class="thumbnail" />';
  html += '<div class="gradient"></div>';
  html += '<div class="action ';
  if (type == 'new') {
    html += 'add';
  } else if (type == 'in-playlist') {
    if ( hasVoted( ytid ) ) {
      html += "voted";
    } else {
      html += 'vote';
    }
  }
  html += '"><div class="icon"></div></div>';
  html += '<div class="title">'+title+'<div class="length">'+secondsToHms(length)+'</div></div>';
  html += "</li>";
  return html;
}

function suggestionHtml(entry) {
  var html = '<li class="video-item suggestion" \
      data-ytid="'+ entry.videoId+'" \
      data-title="'+ entry.title+'" \
      >';
  html += '<div class="thumbnail-container"><img src="http://img.youtube.com/vi/'+ entry.videoId+'/hqdefault.jpg" class="thumbnail" /></div>';
  html += '<div class="gradient"></div>';
  html += '<div class="action suggest"><div class="icon"></div></div>';
  html += '<div class="title">'+entry.title+'</div>';
  html += "</li>";
  return html;
}

function suggestionLinks() {
  var html = '';
  $.each(heyLetsDj.playlist, function(i, entry){
    html += suggestionHtml(entry);
  });
  return html;
}



function renderYoutubeSearchResults(resp) {
  // Sort them into inPlaylist or newVid.
  var inPlaylist = [];
  var newVid = [];
  $.each(resp.feed.entry, function(i,video){
    var ytid = video.id.$t.substring(video.id.$t.length-11);
    if ( orderedYtidPlaylist().indexOf( ytid ) > -1 ) {
      inPlaylist.push(video);
    } else {
      newVid.push(video);
    }
  });  
  $('ol#search-results').html('');
  $.each(inPlaylist, function(i,video){
    $('ol#search-results').html( $('ol#search-results').html() + searchResultHtml(video, 'in-playlist') );
  });
  $.each(newVid, function(i,video){
    $('ol#search-results').html( $('ol#search-results').html() + searchResultHtml(video, 'new') );
  });
  linkifyEverything();
  $('html,body').animate({scrollTop:0},200);
  return 1;
}


function performYoutubeQuery(query, type, seed) {
  if (xhr) {
    xhr.abort();
  }
  if (type == 'organic') {
    var url = 'https://gdata.youtube.com/feeds/api/videos?max-results=50&alt=json&format=5&q=' + encodeURIComponent(query);
  } else if (type ='related') {
    var url = 'https://gdata.youtube.com/feeds/api/videos/'+encodeURIComponent(query)+'/related?v=2&alt=json';
  }
  var xhr = $.ajax({
     type: 'GET',
     dataType : 'json',
     url: url,
     success : function(resp){
      if (type == 'organic') {
        $('#search-result-label').html( 'results for <em>'+query+'</em>' );
        $('#search-instructions').html( '' );
        $('#search-loading-text').hide().html( '' );
      } else if (type == 'related') {
        $('#search-result-label').html( 'videos related to <em>'+seed+'</em>' );
        $('#search-instructions').html( '' );
        $('#search-loading-text').hide().html( '' );
      }
      renderYoutubeSearchResults(resp);
     }
   });
}

function expandSearchUi() {
  $('#add-top-container').addClass('searching');
}
function collapseSearchUi() {
  $('#add-top-container').removeClass('searching');
}

function ytidToEntryId(ytid) {
  var id = false;
  $.each(heyLetsDj.playlist, function(i,entry) {
    if (entry.videoId == ytid) {
      id = entry.id
      return false;
    }
  });
  return id;
}

var scrollTo = false;
var added = [];
function linkifyEverything() {
  $('#playlist-container .action').unbind();
  $('#playlist-container .action.vote').click(function(e){
    // Update event handling.
    runUpdateLoop = false;
    $(this).unbind('click').removeClass('vote').addClass('voted');
    var videoItem = $(this).parent().parent();
    heyLetsDj.upvote( ytidToEntryId( videoItem.data('ytid') ) );
    if (xhr) {
      xhr.abort();
    }
    scrollTo = videoItem.data('ytid');
    // Change the state.
    videoItem.removeClass('vote').addClass('voted');
    hideInstructions();
    if ($('body').hasClass('playlist')) {
      displayOverlay('Sending vote...');
    }
    linkifyEverything();
    updatePlaylistUI = true;
    var trash = refreshPlaylistUI();
    runUpdateLoop = true;
  });
  $('ol#search-results .action.vote').click(function(e){
    log('Voting up video.');
    // Update event handling.
    $(this).unbind('click').removeClass('vote').addClass('voted');
    log('Unbound');
    var videoItem = $(this).parent();
    heyLetsDj.upvote( ytidToEntryId( videoItem.data('ytid') ) );
    if (xhr) {
      xhr.abort();
    }
    scrollTo = videoItem.data('ytid');
    // Change the state.
    videoItem.removeClass('vote up').addClass('voted');
    hideInstructions();
    linkifyEverything();
  });
  $('ol#search-results .action.add').click(function(e){
    log('Adding video.');
    // Update event handling.
    $(this).unbind('click').removeClass('add').addClass('voted');
    log('Unbound');
    // Add to the playlist.
    var videoItem = $(this).parent();
    if ( added.indexOf( videoItem.data('ytid') ) > -1  ) {
      // Already added.
      return 0;
    } else {
      added.push( videoItem.data('ytid') );
    }
    heyLetsDj.add( videoItem.data('ytid') );
    if (xhr) {
      xhr.abort();
    }
    scrollTo = videoItem.data('ytid');
    // Change the state.
    videoItem.removeClass('add').addClass('voted');
    hideInstructions();
    updatePlaylistUI = true;
    linkifyEverything();
  });
  $('ol#search-results .action.suggest').click(function(e){
    // Add to the playlist.
    var ytid = $(this).parent().data('ytid');
    var title = $(this).parent().data('title');
    searchRelated(ytid, title);
  });
}

function scrollMe() {
  log('ScrollMe was called, but dont know if running... ' + scrollTo);
  if ((scrollTo) && ($("#playlist-container .video-item[data-ytid='"+scrollTo+"']").length > 0)) {
    log('SCROLLING to '+scrollTo);
    $('html, body').animate({
         scrollTop: $("#playlist-container .video-item[data-ytid='"+scrollTo+"']").offset().top - 200
     }, 200);
    scrollTo = false;
  }
}

function displayOverlay(opt_content) {
  if (typeof opt_content == 'undefined') {opt_content = 'One sec...';}
  $('#overlay-inner').html(opt_content);
  $('#overlay-container').show();
  $('#overlay-container').css({'opacity':'1'});
}
function hideOverlay() {
  $('#overlay-container').css({'opacity':'0'});
  var trash = setTimeout( function(){$('#overlay-container').hide()}, 200 );
}


$('#back-button').click(togglePlaylistAdd);
$('#add-button').click(togglePlaylistAdd);
$('#search-input').focus( expandSearchUi ); //.keyup(updateYoutubeSearch);
$('#search-input').keypress(function (e) {
  if (e.which == 13) {
    updateYoutubeSearch();
    e.preventDefault();
  }
});
$('#search-button').click(updateYoutubeSearch);



// INSTRUCTION HIDING LOGIC
if (localStorage['voted'] != 'true') {
  $('#instructions-container').removeClass('hidden');
}
function hideInstructions() {
  $('#instructions-container').addClass('hidden');
  localStorage['voted'] = 'true';
}


function orderedYtidPlaylist() {
  var array = [];
  $.each(heyLetsDj.playlist, function(i,entry){
    array.push(entry.videoId);
  });
  return array;
}


function playlistVideoItemHtml(entry, rank) {
  var html = '';
  html += "<div class='video-item' style='top:9999px;' data-ytid='"+entry.videoId+"' data-entryId='"+entry.id+"'>";
  html += "<div class='video-item-inner'>";
  html += "<div class='title'>";
  html += "<div class='text'>";
  html += entry.title;
  html += "</div>";
  html += "</div>";
  html += "<div class='action ";
  if ( entry.voted == true ) {
    html += "voted";
  } else if ( entry.voted == false ) {
    html += "vote";
  }
  log('running from playlistVideoItemHtml with:');
  log(entry);
  // if ( hasVoted(entry.videoId) ) {
  //   html += "voted";
  // } else {
  //   html += "vote";
  // }
  html += "'><div class='icon'></div><div class='vote-count'>"+entry.voteCount+"</div></div>";
  html += "<div class='background'></div>";
  html += "<div class='standout-background'></div>";
  html += "</div>";
  html += "</div>";
  return html;
}

//  THE HEYLETSDJ API INTEGRTION

var updatePlaylistUI = true;
var updatePlayingUI = true;

heyLetsDj.onRefresh = function(playlistInfo) {
  // WE HAVE PLAYLIST INFORMATION.
  // WE ALSO HAVE ACCESS TO THE PLAYLIST @ heyLetsDj.playlist
  updatePlaylistUI = true;
  updatePlayingUI = true;
  refreshPlaylistUI();
  refreshPlayingUI();
  linkifyEverything();
  updatePlayingUI = true;
  refreshAddFixedScrollStuff();

console.log('refresh(' + playlistInfo + ')');
console.log(playlistInfo);
console.log(heyLetsDj.playlist);
}

heyLetsDj.onAdd = function(entryInfo) {
  updatePlaylistUI = true;
  console.log('add(' + entryInfo.id + ', ' +
                       entryInfo.videoId + ', "' +
                       entryInfo.title + '", ' +
                       entryInfo.duration +
              ')');
  console.log(heyLetsDj.playlist);
}

heyLetsDj.onUpvote = function(entryId, voteCount, oldRank, newRank) {
  updatePlaylistUI = true;
  console.log('upvote(' + entryId + ', ' +
                          voteCount + ', ' +
                          oldRank + ', ' +
                          newRank +
              ')');
  console.log(heyLetsDj.playlist);
}

heyLetsDj.onPlay = function(seekTime) {
  updatePlayingUI = true;
  console.log('play(' + seekTime + ')');
}

heyLetsDj.onPause = function(seekTime) {
  updatePlayingUI = true;
  console.log('pause(' + seekTime + ')');
}

heyLetsDj.onSeek = function(seekTime) {
  updatePlayingUI = true;
  console.log('seek(' + seekTime + ')');
}

heyLetsDj.onStop = function() {
  updatePlayingUI = true;
  console.log('stop()');
}

heyLetsDj.onNext = function(crossfadeSeconds) {
  updatePlayingUI = true;
  updatePlaylistUI = true;
  console.log('next(' + crossfadeSeconds + ')');
  console.log(heyLetsDj.playlist);
}
heyLetsDj.onPlayerUpdate = function(){
  updatePlayingUI = true;
  updatePlaylistUI = true;  
}
heyLetsDj.onPlaylistUpdate = function(){
  updatePlayingUI = true;
  updatePlaylistUI = true;  
}


heyLetsDj.start();


function refreshPlaylistUI() {
  if (updatePlaylistUI) {
    log('Updating UI.');
    if ($('body').hasClass('playlist')) {
      displayOverlay('Updating list');      
    }
    var playlistHeight = heyLetsDj.playlist.length * 60;
    $('#playlist-container').height( playlistHeight+'px' );
    $.each(heyLetsDj.playlist, function(i,entry) {
      if ((heyLetsDj.status == 'playing') || (heyLetsDj.status == 'paused')) {
        i = i-1;
      }
      var top = i * 60;
      if (i == -1) {
        // Now playing.
        top = -210;
      }
      var element = $('#playlist-container .video-item[data-entryId="'+entry.id+'"]');
      if (element.length > 0) {
        if (  parseInt( element.find('.vote-count').html() ) < entry.voteCount ) {
          // The element is moving. Latch then remove a moving class on to it.
          element.addClass('standout');
          var trash = setTimeout( function(){$('.standout').removeClass('standout')}, 100);
          log('add and removed class');
        }
        if ( entry.voted == false ) {
          // Make sure that it doesn't display already voted. Mostly for the skipping / played times.
          element.find('.action').removeClass('voted').addClass('vote');
        } else if ( entry.voted == true ) {
          element.find('.action').removeClass('vote').addClass('voted');
        }
        element.css({'top':top+'px'});
        element.find('.vote-count').html( entry.voteCount );
      } else {
        $('#playlist-container').html( $('#playlist-container').html() + playlistVideoItemHtml(entry, i) );
        $('#playlist-container .video-item[data-entryId="'+entry.id+'"]').css({'top':top+'px'});  
      }
    });
    var trash = setTimeout( hideOverlay, 100 );
    if ($('body').hasClass('playlist')) {
      var trash2 = setTimeout( scrollMe, 100 );
    }
    linkifyEverything();
    updatePlaylistUI = false;
    return 1;
  } else {
    log('No need to update the UI.');
    return 0;
  }
}
var runUpdateLoop = true;
var updateUiTimeInterval = false;
function refreshPlayingUI() {
  if (updatePlayingUI) {
    log('updating the playing UI.');
    var nowPlayingEntry = heyLetsDj.playlist[0];
    if (heyLetsDj.status == 'playing') {
      $('#now-playing-container').removeClass('hidden');
      // Update the current playing information.
      $('#now-playing-container .text .title').html( nowPlayingEntry.title );
      $('#now-playing-container .text .now-playing-label').html( 'Now Playing:' );
      $('#now-playing-container .thumb img').attr('src', 'http://img.youtube.com/vi/'+nowPlayingEntry.videoId+'/hqdefault.jpg');
      // Update the time.
      clearInterval(updateUiTimeInterval);
      updateUiTimeInterval = setInterval(
        function(){if (runUpdateLoop) {updateUiTime();}},
        1000);
    } else if (heyLetsDj.status == 'paused') {
      $('#now-playing-container').removeClass('hidden');
      // Update the current playing information
      $('#now-playing-container .text .title').html( nowPlayingEntry.title );
      $('#now-playing-container .text .now-playing-label').html( 'Now Paused:' );
      $('#now-playing-container .thumb img').attr('src', 'http://img.youtube.com/vi/'+nowPlayingEntry.videoId+'/hqdefault.jpg');
      // Update the time.
      clearInterval(updateUiTimeInterval);
      updateUiTimeInterval = setInterval(
        function(){if (runUpdateLoop) {updateUiTime();}},
        1000);
    } else if (heyLetsDj.status == 'stopped') {
      // Stop it all!
      clearInterval(updateUiTimeInterval);
      $('#now-playing-container').addClass('hidden');
    }
    updatePlayingUI = false;
  }
}

function updateUiTime() {
  var newTime = heyLetsDj.playlist[0].duration - heyLetsDj.getSeekTime();  
  $('#now-playing-container .text .counter').html( secondsToHms(newTime) );
}

function hasVoted(ytid) {
  var hasVoted = false;
  $.each(heyLetsDj.playlist, function(i, entry){
    if ((ytid == entry.videoId) && (entry.voted == true)) {
      hasVoted= true;
    }
  });
  return hasVoted;
}

var updatePlaylistUIInterval = setInterval(
    refreshPlaylistUI,
    500
  );

var updatePlayingUIInterval = setInterval(
    refreshPlayingUI,
    500
  );


linkifyEverything();
