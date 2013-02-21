/*
   GNU FM -- a free network service for sharing your music listening habits

   Copyright (C) 2009 Free Software Foundation, Inc

   @licstart  The following is the entire license notice for the
   JavaScript code in this page.

   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU Affero General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU Affero General Public License for more details.

   You should have received a copy of the GNU Affero General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>.

   @licend  The above is the entire license notice
   for the JavaScript code in this page.
*/

var audio;
var scrobbled, now_playing;
var artist, album, track, trackpage, session_key, radio_key, ws_key;
var playlist = [], current_song = 0;
var player_ready = false;
var playable_songs = false;
var streaming = false;
var example_tags = "e.g. guitar, violin, female vocals, piano";
var error_count = 0;
var base_url = base_url || "";

/**
 * Initialises the javascript player (player.tpl must also be included on the target page)
 *
 * @param array list A playlist in the form ([artist, album, track, trackurl, trackpage], [...]) or false if playing a radio stream
 * @param string sk Scrobble session key or false if the user isn't logged in
 * @param string rk Radio session key or false if streaming isn't required
 */
function playerInit(list, sk, ws, rk) {
	audio = document.getElementById("audio");
	if (!list) {
		// We're playing a stream instead of a playlist
		streaming = true;
	}

	session_key = sk;
	ws_key = ws;
	radio_key = rk;

	if(typeof audio.duration == "undefined") {
		//Browser doesn't support <audio>
		if(streaming) {
			$("#audio").replaceWith("<p>Sorry, you need a browser capable of using the HTML 5 &lt;audio&gt; element to enjoy the streaming service via the Javascript player.</p>");
		}
		return;
	}
	$("#fallbackembed").remove(); // Get rid of the fallback embed, otherwise some html5 browsers will play it in addition to the js player
	if (streaming) {
		// Get playlist from radio service
		getRadioPlaylist();
	} else {
		// Otherwise we have a static playlist
		playlist = list;
		playerReady();
	}
}

/**
 * Finishes the player initialisation when the playlist has been loaded
 */
function playerReady() {
	populatePlaylist();
	if(!playable_songs) {
		return;
	}
	loadSong(0);
	audio.pause();
	audio.addEventListener("ended", songEnded, false);
	audio.addEventListener("error", songError, false);
	updateProgress();
	$("#play").fadeTo("normal", 1);
	$("#pause").fadeTo("normal", 1);
	$("#pause").hide();
	$("#ban").fadeTo("normal", 1);
	$("#love").fadeTo("normal", 1);
	$("#open_tag").fadeTo("normal", 1);
	$("#volume").fadeTo("normal", 1);
	$("#progressbar").progressbar({ value: 0 });
	$("#player > #interface").show();
	$("#tags").placeholdr({placeholderText: example_tags});
	$("#volume-slider").slider({range: "min", min: 0, max: 100, value: 60, slide: setVolume});
	loadVolume();
	player_ready = true;
}

/**
 * Begins playback
 */
function play() {
	audio.play();
	$("#play").hide();
	$("#pause").show();
	$("#seekforward").fadeTo("normal", 1);
	$("#seekback").fadeTo("normal", 1);
}

/**
 * Pauses playback
 */
function pause() {
	audio.pause();
	$("#play").show();
	$("#pause").hide();
	$("#seekforward").fadeTo("normal", 0.5);
	$("#seekback").fadeTo("normal", 0.5);
}

/**
 * Seeks backwards 10 seconds in the current song
 */
function seekBack() {
	try {
		audio.currentTime = audio.currentTime - 10;
	} catch (e) {}
}

/**
 * Seeks forwards 10 seconds in the current song
 */
function seekForward() {
	try {
		audio.currentTime = audio.currentTime + 10;
	} catch (e) {}
}

/**
 * Updates the progress bar every 900 milliseconds
 */
function updateProgress() {
	if (audio.duration > 0) {
		$("#progressbar").progressbar('option', 'value', (audio.currentTime / audio.duration) * 100);
		$("#duration").text(friendlyTime(audio.duration));
	} else {
		$("#duration").text(friendlyTime(0));
	}

	if(!now_playing && audio.currentTime > 0) {
		error_count = 0;
		nowPlaying();
	}

	if (!scrobbled && audio.currentTime > audio.duration / 2) {
		scrobble();
	}
	$("#currenttime").text(friendlyTime(audio.currentTime));
	setTimeout("updateProgress()", 900)
}

/**
 * Called automatically when a song finished. Loads the next song if there is one
 */
function songEnded() {
	if(current_song == playlist.length - 1) {
		pause();
	} else {
		loadSong(current_song+1);
		play();
	}
}

/**
 * Called automatically when a song returns an error.
 * Loads the next song after a delay or does nothing if there has been several song errors in a row.
 */
function songError() {
	if (error_count < 10 ) {
		error_count = error_count + 1;
		setTimeout("songEnded()", 3000);
	}
}

/**
 * Outputs the HTML playlist
 */
function populatePlaylist() {
	var i, url;
	//Clear the list
	$("#playlist > #songs").text("");
	for(i = 0; i < playlist.length; i++) {
		url = playlist[i]["url"];
		// Remove non-streamable tracks
		if (url == "") {
			playlist.pop(song); // hur, pop song.
		} else {
			playable_songs = true;
		}
		$("#playlist > #songs").append("<li id='song-" + i + "'><a href='#' onclick='playSong(" + i + "); return false;'>" + playlist[i]["artist"] + " - " + playlist[i]["track"] + "</li>");
	}
	$("#song-" + current_song).css({fontWeight : "bold"});
}

/**
 * Shows/Hides the HTML playlist display
 */
function togglePlaylist() {
	$("#playlist").toggle(1000);
	$("#showplaylist").toggle();
	$("#hideplaylist").toggle();
}

/**
 * Submits a scrobble for the current song if a scrobble session key has been
 * provided. Makes use of a simple proxy to support installations where the
 * gnukebox installation is at a different domain/sub-domain to the nixtape
 * installation.
 */
function scrobble() {
	var timestamp;
	scrobbled = true;
	if(!session_key) {
		//Not authenticated
		return;
	}
	timestamp = Math.round(new Date().getTime() / 1000);
	$.post(base_url + "/scrobble-proxy.php?method=scrobble", { "a[0]" : artist, "b[0]" : album, "t[0]" : track, "i[0]" : timestamp, "s" : session_key },
			function(data){
				if(data.substring(0, 2) == "OK") {
					$("#scrobbled").text("Scrobbled");
					$("#scrobbled").fadeIn(5000, function() { $("#scrobbled").fadeOut(5000) } );
				} else {
					$("#scrobbled").text(data);
					$("#scrobbled").fadeIn(1000);
				}
			}, "text");
}

/**
 * Submits 'now playing' data to the gnukebox server. Like scrobble() this
 * makes use of a proxy.
 */
function nowPlaying() {
	var timestamp;
	now_playing = true;
	if(!session_key) {
		//Not authenticated
		return;
	}
	timestamp = Math.round(new Date().getTime() / 1000);
	$.post(base_url + "/scrobble-proxy.php?method=nowplaying", { "a" : artist, "b" : album, "t" : track, "l" : audio.duration, "s" : session_key}, function(data) {}, "text");
}

/**
 * Loads a song and beings playing it.
 *
 * @param int song The song number in the playlist that should be played
 */
function playSong(song) {
	loadSong(song);
	play();
}

/**
 * Loads a song
 *
 * @param int song The song number in the playlist that should be loaded
 */
function loadSong(song) {
	try {
		var url = playlist[song]["url"];
		artist = playlist[song]["artist"];
		album = playlist[song]["album"];
		track = playlist[song]["track"];
		trackpage = playlist[song]["trackpage"];
	} catch (e) {
		// Handle a possible TypeError when song < 0 or song >= playlist.length
		return;
	}

	// Highlight current song in the playlist
	$("#song-" + current_song).css({fontWeight : "normal"});
	$("#song-" + song).css({fontWeight : "bold"});

	current_song = song;
	scrobbled = false;
	now_playing = false;
	audio.src = url;
	audio.load();

	if(streaming && current_song > playlist.length - 3) {
		//Update the playlist before the user reaches the end
		getRadioPlaylist();
	}

	if(current_song > 0) {
		$("#skipback").fadeTo("normal", 1.0);
	} else {
		$("#skipback").fadeTo("normal", 0.5);
	}

	if(current_song < playlist.length - 1) {
		$("#skipforward").fadeTo("normal", 1.0);
	} else {
		$("#skipforward").fadeTo("normal", 0.5);
	}

	$("#trackinfo > #artistname").text(artist);
	$("#trackinfo > #trackname").text(track);
	$("#ban").fadeTo("normal", 1);
	$("#love").fadeTo("normal", 1);

	if($("#flattrstream")) {
		$.getJSON(base_url + '/2.0/', {'method' : 'artist.getflattr', 'artist' : artist, 'format' : 'json'}, updateFlattr);
	}
}

function updateFlattr(data) {
	var flattr_uid = data.flattr.flattr_uid;
	if (flattr_uid) {
		$("#flattr").empty();
		$("#flattr").html('<a class="FlattrButton" style="display:none;" title="' + artist + ' - ' + track + '" rev="flattr;uid:' + flattr_uid + ';category:audio;tags:music,creative commons,free,libre.fm;" href="' + trackpage + '">' + artist + ' is making ' + track + ' freely available on Libre.fm for you to listen to, share and remix however you like.</a>');
		FlattrLoader.setup();
		$("#flattrstream").show(1000);
	} else {
		$("#flattrstream").hide(1000);
	}
}

/**
 * Retrieves a playlist from the radio streaming service.
 * A radio session key must be supplied when initialising
 * the play for this to work.
 */
function getRadioPlaylist() {
	var tracks, artist, album, title, url, extension, trackpage_url, i;
	$.get(base_url + "/2.0/", {'method' : 'radio.getPlaylist', 'sk' : radio_key}, function(data) {
			parser=new DOMParser();
			xmlDoc=parser.parseFromString(data,"text/xml");
			tracks = xmlDoc.getElementsByTagName("track")
			for(i = 0; i < tracks.length; i++) {
				try {
					artist = tracks[i].getElementsByTagName("creator")[0].childNodes[0].nodeValue;
					title = tracks[i].getElementsByTagName("title")[0].childNodes[0].nodeValue;
					album = tracks[i].getElementsByTagName("album")[0].childNodes[0].nodeValue;
					url = tracks[i].getElementsByTagName("location")[0].childNodes[0].nodeValue;
					trackpage_url = tracks[i].getElementsByTagName("trackpage")[0].childNodes[0].nodeValue;
					if(checkDupe(playlist, artist, title) === false) {
						playlist.push({"artist" : artist, "album" : album, "track" : title, "url" : url, "trackpage" : trackpage_url});
					}
				} catch(err) {
				}
			}
			if(!player_ready) {
				playerReady();
			} else {
				populatePlaylist();
				// Re-enable the skip forward button now that we have more tracks
				$("#skipforward").fadeTo("normal", 1.0);
			}
		}, "text");
}

/**
 * Check if track is already in playlist
 *
 * @param array Playlist array
 * @param creator Track creator (artist name)
 * @param title Track title
 */
function checkDupe(playlist, creator, title) {
	var i;
	var pl = playlist.slice(-40); //only check against 40 latest tracks in playlist
	for(i in pl) {
		if(pl[i].artist === creator && pl[i].track === title) {
			return i;
		}
	}
	return false;
}

/**
 * Plays the song previous to the current one in the playlist
 */
function skipBack() {
	playSong(current_song - 1);
}

/**
 * Plays the song after the current one in the playlist
 */
function skipForward() {
	playSong(current_song + 1);
}

/**
 * Converts a timestamp to "MM:SS" format.
 *
 * @param int timestamp A timestamp in seconds.
 * @return string The provided time in "MM:SS" format
 */
function friendlyTime(timestamp) {
	mins = Math.floor(timestamp / 60);
	sec = String(Math.floor(timestamp % 60));
	if(sec.length == 1) { sec = "0" + sec }
	return mins + ":" + sec
}

function love() {
	$.post(base_url + "/2.0/", {'method' : 'track.love', 'artist' : artist, 'track' : track, 'sk' : ws_key}, function(data) {}, "text");
	$("#love").fadeTo("normal", 0.5);
	$("#scrobbled").text("Loved");
	$("#scrobbled").fadeIn(5000, function() { $("#scrobbled").fadeOut(5000) } );
}

function ban() {
	$.post(base_url + "/2.0/", {'method' : 'track.ban', 'artist' : artist, 'track' : track, 'sk' : ws_key}, function(data) {}, "text");
	$("#ban").fadeTo("normal", 0.5);
	skipForward();
}

function toggleTag() {
	$("#tag_input").toggle(500);	
	$("#open_tag").toggle();
	$("#close_tag").toggle();
}

function tag() {
	var tags = $("#tags").val();
	if (tags != example_tags && tags != "") {
		$.post(base_url + "/2.0/", {'method' : 'track.addtags', 'artist' : artist, 'track' : track, 'tags' : tags, 'sk' : ws_key}, function(data) {}, "text");
		toggleTag();
		$("#tags").val("");
	}
}

/**
 * Toggle visibility of the volume slider
 */
function toggleVolume() {
	$("#volume-box").toggle(500);
}

/**
 * Set the player volume and store it in a cookie for future sessions
 */
function setVolume(event, vol) {
	audio.volume = parseFloat(vol.value / 100);
	var date = new Date();
	date.setTime(date.getTime()+(315360000000)); // Remember for 10 years
	document.cookie='volume=' + audio.volume + '; expires='+date.toGMTString()+ '; path=/';
}

/**
 * Load the player volume from a cookie
 */
function loadVolume() {
	volume = getCookie('volume');
	if(volume == undefined) {
		return;
	}
	volume = parseFloat(volume);
	$("#volume-slider").slider('value', volume * 100);
	audio.volume = volume;
}

/**
 * Retrieve the contents of a cookie
 */
function getCookie(c_name)
{
	var i,x,y,ARRcookies=document.cookie.split(";");
	for (i=0;i<ARRcookies.length;i++)
	{
		x=ARRcookies[i].substr(0,ARRcookies[i].indexOf("="));
		y=ARRcookies[i].substr(ARRcookies[i].indexOf("=")+1);
		x=x.replace(/^\s+|\s+$/g,"");
		if (x==c_name)
		{
			return unescape(y);
		}
	}
}
