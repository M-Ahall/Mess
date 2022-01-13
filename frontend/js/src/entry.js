class Entry {
	id = 0;
	timestamp = "";
	date = "";
	time = "";
	type = "";
	context = "";
	data = "";
	viewed = false;
	backtrace = "";
	important = false;
	remoteHost = "";
	system = null;

	constructor(system, data) {
		this.system = system;

		this.id         = parseInt(data.Id);
		this.timestamp  = data.Time;
		this.type       = data.Type;
		this.context    = data.Context;
		this.viewed     = data.Viewed;
		this.backtrace  = data.Backtrace;
		this.important  = data.Important;
		this.remoteHost = data.RemoteHost;

		if(system.id !== data.SystemId)
			throw `Entry ${this.id} has different system ID ${data.SystemId} compared to given system ID ${system.id}`;

		if(data.DataBase64)
			this.data = Base64.decode(data.Data);
		else
			this.data = data.data;

		let match = this.timestamp.match(/^(?<date>\d{4}-\d{2}-\d{2})T(?<time>\d\d:\d\d:\d\d)\.(?<fractions>\d+)Z$/);
		this.date = match.groups.date;
		this.time = match.groups.time;
	}
}
