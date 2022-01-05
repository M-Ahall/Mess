var _socketEndpoint = '';
var _socket = null;
var _socketRequestNum = 0;
var _connectionCallbackClosed = null;


class WebSocket {
	socket;
	endpoint = '';
	hooks = {};

	static domainWsAddress() {
		let proto = '';
		switch(location.protocol) {
			case 'http:':  proto = 'ws';  break;
			case 'https:': proto = 'wss'; break;
			default:
				alert('Unknown protocol, aborting.');
		}
		return `${proto}://${location.host}/ws`;
	}

	constructor() {
		this.endpoint = WebSocket.domainWsAddress();
		this.hooks = {
			open:    [],
			close:   [],
			error:   [],
			message: [],
		}

		// Create the websocket this application will use.
		this.socket = new WebSocket(this.endpoint);

		// Connect events to websocket
		this.socket.onopen    = (evt)=>this.hooks.open.forEach((hook, _)=>hook(evt));
		this.socket.onclose   = (evt)=>this.hooks.close.forEach((hook, _)=>hook(evt));
		this.socket.onerror   = (evt)=>this.hooks.error.forEach((hook, _)=>hook(evt));
		this.socket.onmessage = (evt)=>this.hooks.message.forEach((hook, _)=>hook(evt));

		/*o
			console.log("socket connected");
			if(typeof socketConnected == 'function')
				socketConnected();
		}

		this.socket.onclose = function(e) {
			console.log("socket close", e);
			if(_connectionCallbackClosed !== null)
				_connectionCallbackClosed();
		}

		this.socket.onerror = function(e) {
			console.log("socket error", e);
		}

		this.socket.onmessage = function(e) {
			let msg = JSON.parse(e.data)
			msgHandler(msg);
		}
		*/
	}

	addHook(type, func) {
		if(this.hooks[type] === undefined)
			throw "Unknown hook type";

		this.hooks[type].push(func);
	}

}

function socketOnClose(func) {
	_connectionCallbackClosed = func;
}

function socketAddr() {
	let proto = '';
	switch(location.protocol) {
		case 'http:':  proto = 'ws';  break;
		case 'https:': proto = 'wss'; break;
		default:
			alert('Unknown protocol, aborting.');
	}
	return `${proto}://${location.host}/ws`;
}

function socketConnect() {
	_socketEndpoint = socketAddr();

	_socket = new WebSocket(_socketEndpoint)
	_socket.onopen = function() {
		console.log("socket connected");
		if(typeof socketConnected == 'function')
			socketConnected();
	}

	_socket.onclose = function(e) {
		console.log("socket close", e);
		if(_connectionCallbackClosed !== null)
			_connectionCallbackClosed();
	}

	_socket.onerror = function(e) {
		console.log("socket error", e);
	}

	_socket.onmessage = function(e) {
		let msg = JSON.parse(e.data)
		msgHandler(msg);
	}
}

function socketSend(req) {
	_socketRequestNum++;
	req.requestId = _socketRequestNum.toString();
	//req.requestId = crypto.randomUUID();
	_socket.send(JSON.stringify(req));
}
