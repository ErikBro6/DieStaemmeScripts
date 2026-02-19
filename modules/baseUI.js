// ==UserScript==
// @name			ACC-Name
// @author			Mausmajor
// @version			1.0
// @namespace		die-staemme.de
// @description		Zeigt den ACC-Namen statt Rangliste an.
// @include			http://*.beta.tribalwars.net/game.php*
// @include        	http://*die-staemme.de/game.php*
// ==/UserScript==

(function () {
if (!/\/game\.php/i.test(location.pathname)) return;
var win = typeof unsafeWindow != 'undefined' ? unsafeWindow : window;
var api = typeof unsafeWindow != 'undefined' ? unsafeWindow.ScriptAPI : window.ScriptAPI;
if (!api || typeof api.register !== 'function') return;
api.register( '101-Accountname statt Rangliste', true, 'Mausmajor', 'none' );

var $ = typeof unsafeWindow != 'undefined' ? unsafeWindow.$ : window.$;
var game_data = typeof unsafeWindow != 'undefined' ? unsafeWindow.game_data : window.game_data;
if (!$ || !game_data || !game_data.player) return;
var welt =      typeof win.Welt != 'undefined' ? win.Welt : true;
var text = welt ? game_data.player.name + ' (' + game_data.world + ')' : game_data.player.name;
$('#topdisplay a:first').text(text);
})();
