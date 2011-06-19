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

require_once('database.php');
require_once('templating.php');
require_once('user-menu.php');
require_once('data/User.php');
require_once('data/TagCloud.php');
require_once('data/Statistic.php');
require_once('data/GraphTypes.php');

if(!isset($_GET['user']) && $logged_in == false) {
	$smarty->assign('pageheading', 'Error!');
	$smarty->assign('details', 'User not set! You shouldn\'t be here!');
	$smarty->display('error.tpl');
	die();
}

try {
    $user = new User(urldecode($_GET['user']));
} catch (Exception $e) {
    if ($e->getCode() == 22) {
       echo('We had some trouble locating that user.  Are you sure you spelled it correctly?'."\n");
    } else {
    echo 'Caught exception: ',  $e->getMessage(), "\n";
    }
    $user = NULL;
}

if(isset($user->name)) {

	$smarty->assign('stat_barwidth', 320);
	try {
		$smarty->assign('graphtopartists', new GraphTopArtists($user, 20));
	} catch (exception $e) {}

	try {
		$smarty->assign('graphplaysbydays', new GraphPlaysByDays($user, 20));
	} catch (exception $e) {}

	try {
		$smarty->assign('graphtoptracks', new GraphTopTracks($user, 20));
	} catch (exception $e) {
		$smarty->assign('pageheading', 'Couldn\'t get users top tracks!');
		$smarty->assign('details', 'User ' . $user->name . ' doesn\'t seem to have scrobbled anything yet.');
		$smarty->display('error.tpl');
		die();
	}
	$smarty->assign('totaltracks', $user->getTotalTracks());
	
	$smarty->assign('me', $user);
	$smarty->assign('geo', Server::getLocationDetails($user->location_uri));
	$smarty->assign('isme', ($this_user->name == $user->name));
	$smarty->assign('pagetitle', $user->name . '\'s stats');

	$smarty->assign('extra_head_links', array(
			array(
				'rel'   => 'meta',
				'type'  => 'application/rdf+xml' ,
				'title' => 'FOAF',
				'href'  => $base_url.'/rdf.php?fmt=xml&page='.urlencode(str_replace($base_url, '', $user->getURL()))
				),
			array(
				'rel'   => 'stylesheet',
				'type'	=> 'text/css',
				'title' => 'jqPlot CSS',
				'href' 	=> $base_url.'/themes/'.$default_theme.'/css/jquery.jqplot.css'
			)
		));
	
	$submenu = user_menu($user, 'Stats');
        $smarty->assign('submenu', $submenu);
	$smarty->assign('headerfile', 'maxiprofile.tpl');

	$smarty->assign('stats', true);
	$smarty->display('user-stats.tpl');
} else {
	$smarty->assign('pageheading', 'User not found');
	$smarty->assign('details', 'Shall I call in a missing persons report?');
	$smarty->display('error.tpl');
}
