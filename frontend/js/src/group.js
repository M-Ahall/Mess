class Group {
	id = 0;
	name = "";
	systems = [];

	constructor(data) {
		this.id      = parseInt(data.Id);
		this.name    = data.Name;
		this.systems = [];
	}
}
