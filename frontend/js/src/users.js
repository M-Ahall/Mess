var mess;

class MessUsers {
	socket;
	users = {};

	constructor() {
		this.socket = new MessSocket()
		this.socket.addHook('open', evt=>this.socketConnected(evt));
		this.socket.addHook('close', evt=>this.socketClosed(evt));
		this.socket.addHook('error', evt=>this.socketClosed(evt));
		this.socket.addHook('message', evt=>this.msgHandler(evt));
	}

	socketConnected() {
		// Authenticate us
		let req = {
			op: "Authenticate",
			token: localStorage.getItem('authenticationToken'),
		}
		this.socket.send(req);
	}

	socketClosed(evt) {
		$('#connection-closed').show();
	}

	msgHandler(evt) {
		let msg = JSON.parse(evt.data);

		if(msg.Error) {
			alert(msg.Error);
			return;
		}

		switch(msg.Op) {
			case 'Authenticate':
				if(!msg.Data.Ok) {
					localStorage.removeItem(
						'authenticationToken'
					);
					location.href = 'login.html';
				} else
					this.socket.send({ op: 'Users' });
				break;

			case 'Users':
				msg.Data.Users.forEach(uData=>{
					var user = new User(uData);
					this.users[user.id] = user;
					this.addUser(user);
				});

				break;

			case 'BroadcastUserCreated':
				var user = new User(msg.Data.User);
				this.users[user.id] = user;
				this.addUser(user);
				break;

			default:
				console.log(msg);
		}
	}

	addUser(user) {
		$('.users').append(`
		<tr>
			<td>${user.username}</td>
			<td>${user.lastLoginDate}</td>
		</tr>
		`);
	}

	newUser() {
		let username = prompt('Username');
		if(username === null)
			return;
		let req = {
			op: 'CreateUser',
			username: username,
		};
		mess.socket.send(req);
	}
}

$(document).ready(()=>{
	mess = new MessUsers();
});
