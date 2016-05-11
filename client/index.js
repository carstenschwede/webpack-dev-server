var url = require('url');
var SockJS = require("sockjs-client");
var stripAnsi = require('strip-ansi');
var scriptElements = document.getElementsByTagName("script");
var scriptHost = scriptElements[scriptElements.length-1].getAttribute("src").replace(/\/[^\/]+$/, "");

// If this bundle is inlined, use the resource query to get the correct url.
// Else, get the url from the <script> this file was called with.
var urlParts = url.parse(typeof __resourceQuery === "string" && __resourceQuery ?
	__resourceQuery.substr(1) :
	(scriptHost ? scriptHost : "/")
);

var sock = null;
var hot = false;
var initial = true;
var currentHash = "";

var onSocketMsg = {
	hot: function() {
		hot = true;
		console.log("[WDS] Hot Module Replacement enabled.");
	},
	invalid: function() {
		console.log("[WDS] App updated. Recompiling...");
		var msg = {
			source: "webpack",
			type: "recompiling"
		};
		window.postMessage(msg,document.location.href);
	},
	hash: function(hash) {
		currentHash = hash;
	},
	"still-ok": function() {
		console.log("[WDS] Nothing changed.")
	},
	ok: function() {
		var msg = {
			source: "webpack",
			type: "ok"
		};
		window.postMessage(msg,document.location.href);
		if(initial) return initial = false;
		reloadApp();
	},
	warnings: function(warnings) {
		console.log("[WDS] Warnings while compiling.");
		var strippedWarnings = warnings.map(w => {
			var strippedWarning = stripAnsi(w);
			console.warn(strippedWarning);
			return strippedWarning;
		});

		var msg = {
			source: "webpack",
			type: "warning",
			msg: strippedWarnings
		};
		window.postMessage(msg,document.location.href);

		if(initial) return initial = false;
		//reloadApp();
	},
	errors: function(errors) {
		console.log("[WDS] Errors while compiling.");


		var strippedErrors = errors.map(w => {
			var strippedError = stripAnsi(w);
			console.error(strippedError);
			return strippedError;
		});

		var msg = {
			source: "webpack",
			type: "error",
			msg: strippedErrors
		};
		window.postMessage(msg,document.location.href);

		if(initial) return initial = false;
		//reloadApp();
	},
	"proxy-error": function(errors) {
		console.log("[WDS] Proxy error.");
		for(var i = 0; i < errors.length; i++)
			console.error(stripAnsi(errors[i]));
		if(initial) return initial = false;
		reloadApp();
	}
};

var newConnection = function() {
	sock = new SockJS(url.format({
		protocol: urlParts.protocol,
		auth: urlParts.auth,
		hostname: (urlParts.hostname === '0.0.0.0') ? window.location.hostname : urlParts.hostname,
		port: urlParts.port,
		pathname: urlParts.path === '/' ? "/sockjs-node" : urlParts.path
	}));

	sock.onclose = function() {
		console.error("[WDS] Disconnected!");

		// Try to reconnect.
		sock = null;
		setTimeout(function () {
			newConnection();
		}, 2000);
	};

	sock.onmessage = function(e) {
		// This assumes that all data sent via the websocket is JSON.
		var msg = JSON.parse(e.data);
		onSocketMsg[msg.type](msg.data);
	};
};

newConnection();

function reloadApp() {
	if(hot) {
		console.log("[WDS] App hot update...");
		window.postMessage("webpackHotUpdate" + currentHash, "*");
	} else {
		console.log("[WDS] App updated. Reloading...");
		window.location.reload();
	}
}
