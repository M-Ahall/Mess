var _socket = null;

function socketOpened() {
	$('.widget.login').show();
	$('[name=username]').focus();
}

function socketClosed() {
	$('.widget').hide();
	$('#connection-closed').show();
	$('.socket-address').html(MessSocket.domainWsAddress());
}

function getAuthenticationToken() {
	let req = {
		op: "Login",
		username: $('[name="username"]').val(),
		password: $('[name="password"]').val(),
	}
	_socket.send(req);
}

function msgHandler(msg) {
	switch(msg.Op) {
		case 'Login':
			if(msg.Data.Token == '') {
				$('#failed').html('Login failed');
				setTimeout(()=>$('#failed').html('&nbsp;'), 750);
				break;
			}

			localStorage.setItem('authenticationToken', msg.Data.Token);
			location.href = '/';
			break;

		default:
			console.log(msg);
	}
}

$(document).ready(()=>{
	_socket = new MessSocket();
	_socket.addHook('open', socketOpened);
	_socket.addHook('close', socketClosed);
	_socket.addHook('error', socketClosed);
	_socket.addHook('message', msgHandler);
});
