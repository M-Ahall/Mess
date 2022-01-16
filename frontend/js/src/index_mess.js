var mess;

/*
var _system = null;
*/
var _entries = {};
var _notification = null;
var _viewTimeout = null;
var _selectFrom = null;
var _resizeEntries = false;
var _hookEntryId = null;

class Mess {
	socket;
	ui;

	// Model data for groups, systems and entries,
	// to not use the DOM as the storage system.
	groups = {};
	systems = {};
	entries = {};

	constructor() {
		this.ui = new UI(this);

		this.socket = new MessSocket()
		this.socket.addHook('open', evt=>this.socketConnected(evt));
		this.socket.addHook('close', evt=>this.socketClosed(evt));
		this.socket.addHook('error', evt=>this.socketClosed(evt));
		this.socket.addHook('message', evt=>this.msgHandler(evt));
	}

	socketConnected(evt) { //{{{
		// Authenticate us
		let req = {
			op: "Authenticate",
			token: localStorage.getItem('authenticationToken'),
		}
		this.socket.send(req);
	} //}}}
	socketClosed(evt) { //{{{
		this.ui.socketClosed();
	} //}}}
	msgHandler(msg) { //{{{
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
					this.requestGroupsAndSystems();

				break;

			case 'Groups':
				this.addGroups(msg.Data.Groups);
				break;

			case 'SystemEntries':
				if(msg.Data.LogEntries === null)
					break;
				msg.Data.LogEntries.forEach(entryData=>{
					this.addEntry(entryData);
					var entry = this.entries[entryData.Id];
					if(entry !== undefined)
						this.ui.updateSeenEntries(
							entry,
							'add',
						);
				});

				// Deep-linked entry id
				if(mess.ui.hookEntryId !== null) {
					var entry = mess.entries[
						mess.ui.hookEntryId
					];
					if(entry !== undefined)
						this.ui.selectEntry(entry);
					this.ui.hookEntryId = null;
				}
				break;

			case 'LogEntry':
				this.ui.logNotification();
				var system =
					this.systems[msg.Data.Entry.SystemId];
				if(system === undefined) {
					alert(
						`Unknown system id: `+
						`${msg.Data.Entry.SystemId}`
					);
					break;
				}
				var entry = new Entry(system, msg.Data.Entry);
				this.ui.updateSeenEntries(entry, 'add');

				if(!this.addEntry(msg.Data.Entry))
					break;
				if(this.ui.tailLog())
					this.ui.selectEntry(entry)

				break;

			case 'BroadcastSeenEntry':
				/* this.ui.updateSeenEntries needs to look at
				 * the cached entry to see if it previously was
				 * viewed. Update to mess entries is made 
				 * afterwards. */
				var currentEntry =
					this.entries[msg.Data.Entry.Id];
				this.ui.updateSeenEntries(currentEntry, 'seen');
				this.entries[msg.Data.Entry.Id].viewed =
					msg.Data.Entry.Viewed;
				break;

			case 'BroadcastGroupCreated':
				var group = new Group(msg.Data.Group);
				this.groups[group.id] = group;
				this.ui.addGroup(group);
				break;

			case 'BroadcastGroupDeleted':
				var group = this.groups[msg.Data.Group.Id];
				this.deletedGroup(group);
				break;

			case 'BroadcastGroupRenamed':
				var group = this.groups[msg.Data.Group.Id];
				this.deletedGroup(group);

				group = new Group(msg.Data.Group);
				this.ui.addGroup(group);
				group.systems.forEach(system=>{
					this.ui.addSystem(system);
				});
				break;

			case 'BroadcastSystemCreated':
				var group = this.groups[msg.Data.GroupId];
				var system = new System(group, msg.Data.System);
				this.systems[system.id] = system;
				this.groups[msg.Data.GroupId].systems.push(
					system,
				);
				this.ui.addSystem(system);
				break;

			case 'BroadcastSystemDeleted':
				var system = this.systems[msg.Data.System.Id];
				this.ui.deletedSystem(system);
				break

			case 'BroadcastSystemRenamed':
				var system = this.systems[msg.Data.System.Id];
				system.name = msg.Data.System.Name;
				this.ui.deletedSystem(system);
				this.ui.addSystem(system);
				break;

			case 'BroadcastEntryDeleted':
				var entry = this.entries[msg.Data.Entry.Id];
				this.ui.deletedEntry(entry);
				this.ui.updateSeenEntries(entry, 'deleted');
				break;

			case 'BroadcastEntryImportantState':
				var entry = this.entries[msg.Data.Entry.Id];
				entry.important = msg.Data.Entry.Important;
				this.ui.updateImportantState(entry);
				break;

			default:
				console.log(msg);
				break;
		}
	} //}}}


	// Group methods
	requestGroupsAndSystems() { //{{{
		// Request groups, systems and unseen count.
		let req = {
			op: "Groups",
		}
		this.socket.send(req);
	} //}}}
	addGroups(groups) { //{{{
		// Remove everything and start over.
		// All current groups are provided.
		this.ui.reset();
		this.groups = {};

		Object.keys(groups).forEach(id=>{
			let groupData = groups[id];
			let group = new Group(groupData);
			this.groups[id] = group;

			// No tree, just a flat list of divs mingling groups and systems.
			this.ui.addGroup(group);
			groupData.Systems.forEach(sysData=>{
				let system = new System(group, sysData);
				this.systems[system.id] = system;
				group.systems.push(system);
				this.ui.addSystem(system);
			});
		});
		this.ui.groupsInitialized();
	} //}}}
	createGroup() { //{{{
		let name = prompt("Group name:");
		if(name === null)
			return;
		let req = {
			op: 'CreateGroup',
			name: name,
		}
		this.socket.send(req);
	} //}}}
	deleteGroup(groupId) { //{{{
		let group = this.groups[groupId];
		if(!confirm(`Are you sure that you want to delete ${group.name}?`))
			return;
		let req = {
			op: 'DeleteGroup',
			groupId: group.id,
		}
		this.socket.send(req);
	} //}}}
	deletedGroup(group) { //{{{
		group.systems.forEach(system=>this.ui.deletedSystem(system));
		this.ui.deletedGroup(group);
	} //}}}
	renameGroup() { //{{{
		let create = this.ui.renameGroup();
		if(create === null)
			return;
		let req = {
			op: 'RenameGroup',
			groupId: create.group.id,
			name: create.name,
		}
		this.socket.send(req);
	} //}}}


	// System methods
	selectSystem(sysId) { //{{{
		sysId = parseInt(sysId);
		let system = this.systems[sysId];
		this.ui.currSystem = system;
		this.ui.selectSystem(system);

		let req= {
			op: "SystemEntries",
			systemId: sysId,
		};
		this.socket.send(req);
	} //}}}
	createSystem() { //{{{
		let res = this.ui.createSystem();
		if(res === null)
			return;
		let req = {
			op: 'CreateSystem',
			groupid: res.group.id,
			name: res.name,
		}
		mess.socket.send(req);
	} //}}}
	deleteSystem() { //{{{
		let system = this.ui.deleteSystem();
		if(system === null)
			return;
		let req = {
			op: 'DeleteSystem',
			systemId: system.id,
		}
		this.socket.send(req);
	} //}}}
	renameSystem() { //{{{
		let res = this.ui.renameSystem();
		if(res === null)
			return;
		let req = {
			op: 'RenameSystem',
			systemId: res.system.id,
			name: res.name,
		}
		this.socket.send(req);
	} //}}}
	insertSeparator(system) { //{{{
		let req = {
			systemId: system.id,
			type: "SEPARATOR",
		}

		$.ajax({
			type: "POST",
			url: "/log",
			data: JSON.stringify(req),
			contentType: "application/json; charset=utf-8",
		});
	} //}}}

	// Entry methods
	addEntry(data) { //{{{
		try {
			let system = this.systems[data.SystemId];
			let entry = new Entry(system, data);

			if(this.ui.currSystem === null)
				return false;

			if(entry.system.id != this.ui.currSystem.id)
				return false;

			this.entries[entry.id] = entry;
			this.ui.addEntry(entry);
		} catch(e) {
		      alert(e);
		}

		return true;
	} //}}}
	markSelectedEntriesSeen() { //{{{
		let entries = this.ui.markSelectedEntriesSeen();
		entries.forEach(entry=>{
			if(entry.viewed)
				return;
			let req = {
				op: "SeenEntry",
				entryId: entry.id,
			};
			this.socket.send(req);
		});
	} //}}}
	deleteEntry(entry) { //{{{
		let req = {
			op: "DeleteEntry",
			entryId: entry.id,
		};
		this.socket.send(req);
	} //}}}
	toggleEntriesImportant() { //{{{
		let entries = this.ui.toggleEntriesImportant();
		entries.forEach(entry=>{
			let req = {
				op: "SetImportant",
				entryId: entry.id,
				isImportant: !entry.important,
			}
			this.socket.send(req);
		});
	} //}}}
}

$(document).ready(()=>{
	mess = new Mess();
	mess.ui.clipboardInit();
	mess.ui.restoreApplicationState();
});

// vim: foldmethod=marker
