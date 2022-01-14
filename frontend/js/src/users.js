var mess;

class MessUsers {
	socket;
	users = {};
	currentUser = null;

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

			case 'LogoutUser':
				var user = this.users[msg.Data.UserId];
				alert(`${user.username} has been logged out.`);
				break;

			case 'BroadcastUserCreated':
				var user = new User(msg.Data.User);
				this.users[user.id] = user;
				this.addUser(user);
				break;

			case 'BroadcastUserUpdated':
				var user = new User(msg.Data.User);
				this.users[user.id] = user;
				$('#user-updated').fadeIn(250);
				setTimeout(
					()=>$('#user-updated').fadeOut(250),
					1500);
				break;

			case 'BroadcastUserRemoved':
				var userId = msg.Data.UserId;
				delete this.users[userId];
				$(`.users .user[x-user-id=${userId}]`).remove();

				if(!this.currentUser)
					break;
				if(this.currentUser.id == userId) {
					$('.fields').hide();
					this.currentUser = null;
				}
				break;

			default:
				console.log(msg);
		}
	}

	addUser(user) {
		$('.users').append(`
		<tr
			class="user"
			x-menu="user"
			x-menu-id="${user.id}"
			x-user-id="${user.id}"
			onClick="mess.selectUser(${user.id})"
			onContextMenu="menuShow('user', event); return false;"
		>
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

	selectUser(userId) {
		let user = this.users[userId];
		this.currentUser = user;

		$(`#users .user`).removeClass('selected');
		$(`#users .user[x-user-id=${userId}]`).addClass('selected');

		$('#username').html(user.username);
		$('#password').val('');
		$('#active').prop('checked', user.active);
		$('#admin').prop('checked', user.admin);

		$('.fields').css('display', 'grid');
	}

	updateUser() {
		let req = {
			op: "UpdateUser",
			userid: this.currentUser.id,
			password: $('#password').val(),
			active: $('#active').is(':checked'),
			admin: $('#admin').is(':checked'),
		}
		this.socket.send(req);
	}

	removeUser() {
		let user = this.users[_menu_selected_id];
		if(!confirm(`Remove user ${user.username}?`))
			return;
		let req = {
			op: "RemoveUser",
			userId: user.id,
		}
		this.socket.send(req);
	}

	logoutUser() {
		let req = {
			op: "LogoutUser",
			userId: parseInt(_menu_selected_id),
		}
		this.socket.send(req);
	}
}

$(document).ready(()=>{
	mess = new MessUsers();
});
