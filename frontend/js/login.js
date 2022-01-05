function loginSocketClosed() {
	$('.widget').hide();
	$('#connection-closed').show();
	$('.socket-address').html(socketAddr());
}

function getAuthenticationToken() {
	let req = {
		op: "Login",
		username: $('[name="username"]').val(),
		password: $('[name="password"]').val(),
	}
	socketSend(req)
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
