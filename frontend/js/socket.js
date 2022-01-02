var _socketEndpoint = `wss://${window.location.hostname}/ws`;
var _socket = null;
var _socketRequestNum = 0;

function socketConnect() {
	_socket = new WebSocket(_socketEndpoint)
	_socket.onopen = function() {
		console.log("socket connected");
		if(typeof socketConnected == 'function')
			socketConnected();
	}

	_socket.onclose = function(e) {
		console.log("socket close", e);
		menuClose();
		$('#connection-closed').show();
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
