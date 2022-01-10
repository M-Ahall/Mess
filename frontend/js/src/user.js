class User {
	id;
	username;
	lastLogin;
	active;
	admin;
	lastLoginDate;
	lastLoginTime;

	constructor(data) {
		this.id        = data.Id;
		this.username  = data.Username;
		this.lastLogin = data.LastLogin;
		this.active    = data.Active;
		this.admin     = data.Admin;

		let match = this.lastLogin.match(/^(?<date>\d{4}-\d{2}-\d{2})T(?<time>\d\d:\d\d:\d\d)(?:\.(?<fractions>\d+))?Z$/);
		this.lastLoginDate = match.groups.date;
		this.lastLoginTime = match.groups.time;
	}
}
