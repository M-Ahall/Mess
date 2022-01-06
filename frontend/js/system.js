class System {
	id = 0;
	name = "";
	comments = "";
	unseenEntries = 0;
	group = null;

	constructor(group, data) {
		this.group         = group;

		this.id            = parseInt(data.Id);
		this.name          = data.Name;
		this.comments      = data.Comments;
		this.unseenEntries = data.UnseenEntries;
	}
}
