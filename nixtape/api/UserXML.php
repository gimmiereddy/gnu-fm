<?php
/* GNU FM -- a free network service for sharing your music listening habits

   Copyright (C) 2009 Free Software Foundation, Inc

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

 */

require_once($install_path . '/database.php');
require_once($install_path . '/data/User.php');
require_once('xml.php');

class UserXML {

	public static function getInfo($username) {

		$user = new User($username);
		if (!$user) {
			return(XML::error('failed', '7', 'Invalid resource specified'));
		}

		$xml = new SimpleXMLElement('<lfm status="ok"></lfm>');
		$user_node = $xml->addChild('user', null);
		$user_node->addChild('name', $user->name);
//		$user_node->addChild('email', $user->email); // should this be public
		$user_node->addChild('homepage', $user->homepage);
		$user_node->addChild('location', $user->location);
		$user_node->addChild('bio', $user->bio);
		$user_node->addChild('profile_created', strftime('%c', $user->created));
		if (isset($user->modified))
			$user_node->addChild('profile_updated', strftime('%c', $user->modified));

		return($xml);
	}

	public static function getTopTracks($username, $time) {
		global $adodb;

		$timestamp;
		if (!isset($time))
			$time = 'overall';
		//TODO: Do better, this is too ugly :\
		if (strcmp($time, 'overall') == 0) {
			$timestamp = 0;
		} else if (strcmp($time, '3month') == 0) {
			$timestamp = strtotime('-3 months');
		} else if (strcmp($time, '6month') == 0) {
			$timestamp = strtotime('-6 months');
		} else if (strcmp($time, '9month') == 0) {
			$timestamp = strtotime('-9 months');
		} else if (strcmp($time, '12month') == 0) {
			$timestamp = strtotime('-12 months');
		} else {
			return(XML::error('error', '13', 'Invalid method signature supplied'));
		}

		$err = 0;
		try {
			$user = new User($user);
			$res = $user->getTopTracks(20, $timestamp);
		}
		catch (exception $e) {
			$err = 1;
		}

		if ($err || !$res) {
			return(XML::error('failed', '7', 'Invalid resource specified'));
		}
		$xml = new SimpleXMLElement('<lfm status="ok"></lfm>');

		$root = $xml->addChild('toptracks', null);
		$root->addAttribute('user', $username);
		$root->addAttribute('type', $time);
		$i = 1;
		foreach($res as &$row) {
			$track = $root->addChild('track', null);
			$track->addAttribute('rank', $i);
			$track->addChild('name', repamp($row['name']));

			$track->addChild('playcount', $row['freq']);
			$artist = $track->addChild('artist', repamp($row['artist']));
			$artist->addChild('mbid', $row['artist_mbid']);  // artist_mbid isn't being set by getTopTracks yet
			$i++;
		}

		return($xml);

	}

	public static function getRecentTracks($u, $limit) {
		global $adodb;

		if (!isset($limit)) {
			$limit = 10;
		}

		$err = 0;
		try {
			$user = new User($u);
			$npres = $user->getNowPlaying(1);
			if($npres) {
				$limit--;
			}
			$res = $user->getScrobbles($limit);
		} catch (exception $e) {
			$err = 1;
		}

		if ($err || !$res) {
			return(XML::error('error', '7', 'Invalid resource specified'));
		}

		$xml = new SimpleXMLElement('<lfm status="ok"></lfm>');
		$root = $xml->addChild('recenttracks', null);
		$root->addAttribute('user', $user->name);

		if($npres) {
			foreach($npres as &$row) {
				$track = $root->addChild('track');
				$track->addAttribute('nowplaying', 'true');
				$row['time'] = time();
				UserXML::_addTrackDetails($track, $row);
			}
		}

		foreach($res as &$row) {
			$track = $root->addChild('track', null);
			UserXML::_addTrackDetails($track, $row);
		}

		return $xml;
	}

	private static function _addTrackDetails($track, $row) {
		$artist = $track->addChild('artist', repamp($row['artist']));
		$artist->addAttribute('mbid', $row['artist_mbid']);
		$name = $track->addChild('name', repamp($row['track']));
		$track->addChild('mbid', $row['track_mbid']);
		$album = $track->addChild('album', repamp($row['album']));
		$album->addAttribute('mbid', $row['album_mbid']);
		$track->addChild('url', Server::getTrackURL($row['artist'], $row['album'], $row['track']));
		$date = $track->addChild('date', gmdate("d M Y H:i",$row['time']) . " GMT");
		$date->addAttribute('uts', $row['time']);
		$track->addChild('streamable', null);
	}

	public static function getTopTags($u, $limit=10) {
		global $base_url;

		try {
			$user = new User($u);
			$res = $user->getTopTags($limit);
		} catch (exception $ex) {
			return XML::error('error', '7', 'Invalid resource specified');
		}

		$xml = new SimpleXMLElement('<lfm status="ok"></lfm>');
		$root = $xml->addChild('toptags');
		$root->addAttribute('user', $user->name);

		foreach($res as &$row) {
			$tag = $root->addChild('tag', null);
			$tag->addChild('name', repamp($row['tag']));
			$tag->addChild('count', repamp($row['freq']));
			$tag->addChild('url', Server::getTagURL($row['tag']));
		}

		return $xml;
	}

	public static function getLovedTracks($u, $limit=50) {
		
		try {
			$user = new User($u);
			$res = $user->getLovedTracks($limit);
		} catch (exception $ex) {
			return XML::error('error', '7', 'Invalid resource specified');
		}

		$xml = new SimpleXMLElement('<lfm status="ok"></lfm>');
		$root = $xml->addChild('lovedtracks');
		$root->addAttribute('user', $user->name);

		foreach($res as &$row) {
			$track = new Track($row['track'], $row['artist']);
			$artist = new Artist($row['artist']);
			$track_node = $root->addChild('track', null);
			$track_node->addChild('name', $track->name);
			$track_node->addChild('mbid', $track->mbid);
			$track_node->addChild('url', $track->getURL());
			$artist_node = $track_node->addChild('artist', null);
			$artist_node->addChild('name', $artist->name);
			$artist_node->addChild('mbid', $artist->mbid);
			$artist_node->addChild('url', $artist->getURL());
		}

		return $xml;

	}

}
?>
