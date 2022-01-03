var _groups = {};
var _systems = {};
var _system = null;
var _entries = {};
var _notification = null;
var _viewTimeout = null;
var _selectFrom = null;
var _resizeEntries = false;

function socketConnected() { //{{{
	// Authenticate us
	let req = {
		op: "Authenticate",
		token: localStorage.getItem('authenticationToken'),
	}
	socketSend(req);
} //}}}
function requestGroupsAndSystems() { //{{{
		// Request groups, systems and unseen count.
		let req = {
			op: "Groups",
		}
		socketSend(req);
} //}}}
function msgHandler(msg) { //{{{
	if(msg.Error) {
		alert(msg.Error);
		return;
	}

	switch(msg.Op) {
		case 'Authenticate':
			if(!msg.Data.Ok) {
				localStorage.removeItem('authenticationToken');
				location.href = 'login.html';
			} else
				requestGroupsAndSystems();

			break;

		case 'Groups':
			addGroups(msg.Data.Groups);
			break;

		case 'SystemEntries':
			if(msg.Data.LogEntries === null)
				break;
			msg.Data.LogEntries.forEach(entry=>{
				addEntry(entry);
				changeViewedMessages(entry, 'add');
			});
			break;

		case 'LogEntry':
			logNotification();
			changeViewedMessages(msg.Data.Entry, 'add');

			if(!addEntry(msg.Data.Entry))
				break;
			if(tailLog())
				selectEntry(msg.Data.Entry.Id)

			break;

		case 'BroadcastSeenEntry':
			$(`[x-entry-id=${msg.Data.Entry.Id}]`).removeClass('new');
			changeViewedMessages(msg.Data.Entry, 'seen');
			// changeViewedMessages needs to look at the cached
			// entry to see if it previously was viewed.
			_entries[msg.Data.Entry.Id] = msg.Data.Entry;
			break;


		case 'BroadcastEntryDeleted':
			deleteEntry(msg.Data.Entry.Id);
			changeViewedMessages(msg.Data.Entry, 'deleted');
			break;

		case 'BroadcastEntryImportantState':
			updateImportantState(msg.Data.Entry);
			break;

		case 'BroadcastGroupCreated':
			addGroup(msg.Data.Group);
			break;

		case 'BroadcastGroupDeleted':
			deletedGroup(msg.Data.Group);
			break;

		case 'BroadcastGroupRenamed':
			renamedGroup(msg.Data.Group);
			break;

		case 'BroadcastSystemCreated':
			_groups[msg.Data.GroupId].Systems.push(msg.Data.System);
			addSystem(msg.Data.GroupId, msg.Data.System);
			break;

		case 'BroadcastSystemDeleted':
			deletedSystem(msg.Data.System);
			break

		case 'BroadcastSystemRenamed':
			renamedSystem(msg.Data.GroupId, msg.Data.System);
			break;

		default:
			console.log(msg);
			break;
	}
} //}}}
function keyHandler(evt) { //{{{
	if(evt.target.id == 'filter')
		return;

	let handled = true;
	switch(evt.key) {
		case "a":
			selectAllEntries();
			break;

		case "b":
			if(evt.ctrlKey) {
				let backtrace = $('#show-backtrace');
				backtrace.prop('checked', !backtrace.is(':checked'));
				toggleBacktrace();
			}
			break;

		case "m":
			markSelectedEntriesSeen();
			break;

		case "s":
			insertSeparator();
			break;

		case "t":
			let tailLog = $('#tail-log');
			tailLog.prop('checked', !tailLog.is(':checked'))
			break;

		case "d":
		case "x":
		case "Delete":
			deleteSelectedEntries();
			break;

		case "c":
		case "y":
			if(evt.key == "c" && !evt.ctrlKey)
				break;

			$('#entry-data-copy').click();
			break;

		case "Y":
			$('#entry-backtrace-copy').click();
			break;

		case "/":
			$('#filter').focus();
			break;

		case "{":
			// Find the prev element from currently selected,
			// and select that.
			var sel = $('.system.selected');
			if(sel.length != 1) {
				// First row is always a group.
				sel = $('.system:nth-child(2)');
				if(sel.length != 1)
					break;
			} else {
				sel = sel.prev();
				while(sel.length > 0 && !sel.hasClass('system'))
					sel = sel.prev();
			}

			var systemId = sel.attr('x-system-id');
			if(systemId === undefined)
				break;

			selectSystem(systemId);
			break;

		case "}":
			// Find the next element from currently selected,
			// and select that.
			var sel = $('.system.selected');
			if(sel.length != 1) {
				// First row is always a group.
				sel = $('.system:nth-child(2)');
				if(sel.length != 1)
					break;
			} else {
				sel = sel.next();
				while(sel.length > 0 && !sel.hasClass('system'))
					sel = sel.next();
			}

			var systemId = sel.attr('x-system-id');
			if(systemId === undefined)
				break;

			selectSystem(systemId);
			break;

		case "j":
		case "J":
		case "ArrowDown":
			// Find the next element from currently selected,
			// and select that.
			var sel = $('.log-entry.show');
			if(sel.length != 1) {
				// First row is headers.
				sel = $('.log-entry:nth-child(2)');
				if(sel.length != 1)
					break;
			} else
				sel = sel.next();

			var entryId = sel.attr('x-entry-id');
			if(entryId === undefined)
				break;

			// If using shift, extend selection downward.
			if(evt.shiftKey)
				clickEntry(evt, entryId);
			else
				selectEntry(entryId);
			break;

		case "k":
		case "K":
		case "ArrowUp":
			// Find the previous element from currently selected,
			// and select that.
			var sel = $('.log-entry.show');
			if(sel.length != 1) {
				// First row is headers.
				sel = $('.log-entry:nth-child(2)');
				if(sel.length != 1)
					break;
			} else
				sel = sel.prev();

			var entryId = sel.attr('x-entry-id');
			if(entryId === undefined)
				break;

			// If using shift, extend selection upward.
			if(evt.shiftKey)
				clickEntry(evt, entryId);
			else
				selectEntry(entryId);
			break;

		case "!":
			toggleImportant();
			break;


		case 'g':
		case 'Home':
			var entryId = $('.log-entry:nth-child(2)').attr('x-entry-id');
			if(entryId === undefined)
				break;
			selectEntry(entryId);
			break;

		case 'G':
		case 'End':
			var entryId = $('.log-entry:last-child').attr('x-entry-id');
			if(entryId === undefined)
				break;
			selectEntry(entryId);
			break;

		default:
			// console.log(evt.key);
			handled = false;
	}
	
	if(handled) {
		evt.stopPropagation();
		evt.preventDefault();
	}
} //}}}

function addGroups(groups) { //{{{
	// Remove everything and start over.
	// All current groups are provided.
	$('#groups').html('');
	_groups = {};

	Object.keys(groups).forEach(id=>{
		var group = groups[id];
		_groups[id] = group;

		// No tree, just a flat list of divs mingling groups and systems.
		addGroup(group);
		group.Systems.forEach(sys=>{
			addSystem(group.Id, sys);
		});

	});
} //}}}
function addGroup(newGroup) { //{{{
	// Place group in the correct, alphabetical place.
	var placeBefore = null;
	var newName = newGroup.Name.toLowerCase();
	_groups[newGroup.Id] = newGroup;

	$('#groups .group .name').each((idx, group)=>{
		if(newName < group.innerHTML.toLowerCase()) {
			placeBefore = group;
			return false;
		}
	});

	// Place last.
	div = `<div
			class='group'
			x-group-id="${newGroup.Id}"
			x-menu-id="${newGroup.Id}"
			onClick="menuShow('group', event); return false;"
			onContextMenu="menuShow('group', event); return false;"
		>
			<div class="name">${newGroup.Name}</div>
		</div>`;
	if(placeBefore === null)
		$('#groups').append(div);
	else {
		$(placeBefore).parent().before(div);
	}
} //}}}
function addEntry(entry) { //{{{
	if(entry.SystemId != _system)
		return false;

	if(entry.DataBase64) {
		entry.Data = Base64.decode(entry.Data);
	}

	_entries[entry.Id] = entry;

	match = entry.Time.match(/^(?<date>\d{4}-\d{2}-\d{2})T(?<time>\d\d:\d\d:\d\d)\.(?<fractions>\d+)Z$/);
	let date = match.groups.date;
	let time = match.groups.time;
	let fractions = match.groups.fractions;

	if(entry.Type == 'SEPARATOR')
		$('table.entries tr:first-child').after(`
			<tr
				class="log-entry separator"
				x-entry-id="${entry.Id}"
				onClick="clickEntry(event, ${entry.Id})"
			>
				<td colspan=5></td>
			</tr>
		`);
	else {
		let filter = (entry.Type+' '+entry.Context).toLowerCase();
		$('table.entries tr:first-child').after(`
			<tr
				class="log-entry ${entry.Viewed ? '' : 'new'} ${entry.Important ? 'important' : ''}"
				x-entry-id="${entry.Id}"
				x-filter="${filter}"
				onClick="clickEntry(event, ${entry.Id})"
			>
				<td>${entry.Id}</td>
				<td>${date}</td>
				<td>${time}</td>
				<td>${entry.Type ? entry.Type : '&nbsp;'}</td>
				<td>${entry.Context ? entry.Context : '&nbsp'}</td>
			</tr>
		`);
	}

	return true;
} //}}}

function createGroup() { //{{{
	let name = prompt("Group name:");
	if(name === null)
		return;
	let req = {
		op: 'CreateGroup',
		name: name,
	}
	socketSend(req);
} //}}}
function deleteGroup() { //{{{
	let group = _groups[_menu_selected_id];
	if(!confirm(`Are you sure that you want to delete ${group.Name}?`))
		return;
	let req = {
		op: 'DeleteGroup',
		groupId: parseInt(group.Id),
	}
	socketSend(req);
} //}}}
function deletedGroup(delGroup) { //{{{
	group = _groups[delGroup.Id];
	group.Systems.forEach(system=>{
		deletedSystem(system);
	});

	$(`.group[x-group-id=${delGroup.Id}]`).remove();
} //}}}
function renameGroup() { //{{{
	let name = prompt("New group name:");
	if(name === null)
		return;
	name = name.trim();
	let req = {
		op: 'RenameGroup',
		groupId: parseInt(_menu_selected_id),
		name: name,
	}
	socketSend(req);
} //}}}
function renamedGroup(group) { //{{{
	deletedGroup(group);

	addGroup(group);
	group.Systems.forEach(system=>{
		addSystem(group.Id, system);
	});
} //}}}

function selectSystem(sysId) { //{{{
	sysId = parseInt(sysId);
	_system = sysId;
	system = _systems[sysId];
	document.title = `${system.Name} - Mess`;
	$('[x-system-id]').removeClass('selected');
	$(`[x-system-id=${sysId}]`).addClass('selected');
	$('#entry-data').html('');
	$('#entry-backtrace').html('');
	$('#entry-info').html('');
	$('#system-info').html(sysId);

	$('table.entries .log-entry').remove();

	// System entries are added one by one and changing the unseen entries
	// count. Resetting system count first makes it right.
	$(`[x-system-id=${sysId}] .unseen`).html('');

	let req= {
		op: "SystemEntries",
		systemId: sysId,
	};
	socketSend(req);
} //}}}
function addSystem(groupId, newSystem) { //{{{
	// Place group in the correct, alphabetical place.
	var placeBefore = null;
	var newName = newSystem.Name.toLowerCase();
	_systems[newSystem.Id] = newSystem;

	let systems = $(`#groups .system[x-group-id=${groupId}] .name`);
	systems.each((idx, system)=>{
		if(newName < system.innerHTML.toLowerCase()) {
			placeBefore = system;
			return false;
		}
	});

	div = `<div
			class='system'
			x-group-id='${groupId}'
			x-system-id='${newSystem.Id}'
			x-menu-id='${newSystem.Id}'
			onClick='selectSystem(${newSystem.Id})'
			onContextMenu="menuShow('system', event); return false;"
		>
			<div class='name'>${newSystem.Name}</div>
			<div class='unseen'>${newSystem.UnseenEntries ? newSystem.UnseenEntries : ''}</div>
		</div>`;

	// Place last.
	if(placeBefore === null) {
		if(systems.length == 0)
			$(`.group[x-group-id=${groupId}]`).after(div);
		else
			$(`.system[x-group-id=${groupId}]`).last().after(div);
	} else {
		$(placeBefore).parent().before(div);
	}
} //}}}
function createSystem() { //{{{
	let name = prompt("System name:");
	if(name === null)
		return;
	let req = {
		op: 'CreateSystem',
		groupid: parseInt(_menu_selected_id),
		name: name,
	}
	socketSend(req);
} //}}}
function renameSystem() { //{{{
	let name = prompt("New system name:");
	if(name === null)
		return;
	name = name.trim();
	let req = {
		op: 'RenameSystem',
		systemId: parseInt(_menu_selected_id),
		name: name,
	}
	socketSend(req);
} //}}}
function deleteSystem() { //{{{
	let system = _systems[_menu_selected_id];
	if(!confirm(`Are you sure that you want to delete ${system.Name}?`))
		return;
	let req = {
		op: 'DeleteSystem',
		systemId: parseInt(system.Id),
	}
	socketSend(req);
} //}}}
function deletedSystem(system) { //{{{
	if(_system == system.Id) {
		$('#entries .log-entry').remove();
		$('#system-info').html('');
		_system = null;
		document.title = 'Mess';
	}
	$(`.system[x-system-id=${system.Id}]`).remove();
} //}}}
function renamedSystem(groupId, system) { //{{{
	deletedSystem(system);
	addSystem(groupId, system);
} //}}}

function clickEntry(evt, entryId) { //{{{
	if(!evt.shiftKey)
		selectEntry(entryId);

	if(evt.shiftKey && _selectFrom !== null) {
		let entries = $('table.entries [x-entry-id]');
		entries.removeClass('selected');
		let idxA = entries.index($(`table.entries [x-entry-id=${_selectFrom}]`));
		let idxB = entries.index($(`table.entries [x-entry-id=${entryId}]`));
		let from = Math.min(idxA, idxB);
		let to   = Math.max(idxA, idxB);

		for(var i = from; i <= to; i++) {
			$(entries[i]).addClass('selected');
		}
	}

	selectEntry(entryId, true);
} //}}}
function deleteSelectedEntries() { //{{{
	let entries = $('.log-entry.selected');
	entries.each((idx, entry)=>{
		let req = {
			op: "DeleteEntry",
			entryId: parseInt($(entry).attr('x-entry-id')),
		};
		socketSend(req);
	});
} //}}}
function markSelectedEntriesSeen() { //{{{
	let entries = $('table.entries .log-entry.selected');
	let entryId = 0;
	entries.each((idx, entry)=>{
		entryId = parseInt($(entry).attr('x-entry-id'))
		if(_entries[entryId].Viewed)
			return;
		let req = {
			op: "SeenEntry",
			entryId: entryId,
		};
		socketSend(req);
	});
} //}}}
function deleteEntry(entryId) { //{{{
	// Empty entry data field if entry to be deleted is the
	// one currently showing.
	if(entryId == $('.log-entry.show').attr('x-entry-id')) {
		$('#entry-data').html('');
		$('#entry-backtrace').html('');
		$('#entry-info').html('');
	}

	let el = $(`[x-entry-id=${entryId}]`);
	if(el.hasClass('show')) {
		let next = el.next('.log-entry');
		let prev = el.prev('.log-entry');
		if(next.length > 0) {
			selectEntry(next.attr('x-entry-id'));
		} else if(prev.length > 0)
			selectEntry(prev.attr('x-entry-id'));
	}
	el.remove();
} //}}}
function selectEntry(entryId, onlyShowData) { //{{{
	if(!onlyShowData) {
		_selectFrom = entryId;
		$('.log-entry[x-entry-id]').removeClass('selected');
		$(`.log-entry[x-entry-id=${entryId}]`).addClass('selected');
	}
	showData(entryId);
} //}}}
function selectAllEntries() { //{{{
	$('table.entries [x-entry-id]').addClass('selected');
} //}}}

function insertSeparator() { //{{{
	let req = {
		systemId: _system,
		type: "SEPARATOR",
	}

	$.ajax({
		type: "POST",
		url: "/log",
		data: JSON.stringify(req),
		contentType: "application/json; charset=utf-8",
	});
} //}}}

function copyDataToClipboard() { //{{{
	let entryId = $('.log-entry.show').attr('x-entry-id');
	if(entryId === undefined)
		return undefined;

	let entry = _entries[entryId];
	if(!entry)
		return undefined;

	return entry.Data;
} //}}}
function copyBacktraceToClipboard() { //{{{
	let entryId = $('.log-entry.show').attr('x-entry-id');
	if(entryId === undefined)
		return undefined;

	let entry = _entries[entryId];
	if(!entry)
		return undefined;

	return entry.Backtrace;
} //}}}

function toggleImportant(entryId) { //{{{
	var entryId;
	$('.log-entry.selected').each((idx, el)=>{
		entryId = $(el).attr('x-entry-id');
		if(entryId === undefined)
			return;
		if(_entries[entryId].Type == 'SEPARATOR')
			return;

		entryId = parseInt(entryId);
		let req = {
			op: "SetImportant",
			entryId: parseInt(entryId),
			isImportant: !_entries[entryId].Important,
		}
		socketSend(req);
	});

} //}}}
function updateImportantState(updatedEntry) { //{{{
	_entries[updatedEntry.Id] = updatedEntry;

	let el = $(`.log-entry[x-entry-id=${updatedEntry.Id}]`);
	if(updatedEntry.Important)
		el.addClass('important');
	else
		el.removeClass('important');
} //}}}
function toggleDate() { //{{{
	let checked = $('#show-date').is(':checked');
	if(checked) {
		$('table.entries').addClass('date');
	} else {
		$('table.entries').removeClass('date');
	}
} //}}}

function toggleBacktrace() { //{{{
	let checked = $('#show-backtrace').is(':checked');
	if(checked)
		showBacktrace();
	else
		hideBacktrace();
} //}}}
function showBacktrace() { //{{{
	$('#layout').removeClass('without-backtrace');
	$('#entry-backtrace').show();
	$('#entry-backtrace-copy').show();

	// Backtrace restore runs this function and needs the checkbox to
	// correspond to the backtrace state.
	$('#show-backtrace').prop('checked', true);

	// Backtrace status is restored on page load.
	localStorage.setItem('backtrace', 'show');
} //}}}
function hideBacktrace() { //{{{
	$('#layout').addClass('without-backtrace');
	$('#entry-backtrace').hide();
	$('#entry-backtrace-copy').hide();

	// Backtrace restore runs this function and needs the checkbox to
	// correspond to the backtrace state.
	$('#show-backtrace').prop('checked', false);

	// Backtrace status is restored on page load.
	localStorage.setItem('backtrace', 'hide');
} //}}}

function resizeEntriesStart() { //{{{
	_resizeEntries = true;
	$('#layout').on('mousemove', resizeEntries);
} //}}}
function resizeEntries(evt) { //{{{
	if(!_resizeEntries)
		return;

	let el = $('#entries');
	let newPos = Math.round(evt.clientX - el.offset().left - 1);
	setLayoutEntriesWidth(newPos);
	evt.preventDefault();
} //}}}
function resizeEntriesStop() { //{{{
	_resizeEntries = false;
	$('#layout').off('mousemove');

	let width = getLayoutEntriesWidth();
	if(width !== null)
		localStorage.setItem('entriesWidth', width);
} //}}}

function changeViewedMessages(entry, op) { //{{{
	if(entry.Type == 'SEPARATOR')
		return;

	// This will happen when seen-marking an already seen entry.
	if(entry.SystemId == 0)
		return;

	let delta = 0;
	switch(op) {
		case 'add':
			if(entry.Viewed)
				return;
			delta = 1;
			break;

		case 'seen':
			let cachedEntry = _entries[entry.Id];
			if(cachedEntry && !cachedEntry.Viewed)
				delta = -1;
			break;

		case 'deleted':
			if(entry.Viewed)
				return;
			delta = -1;
			break;
	}

	let el = $(`.system[x-system-id=${entry.SystemId}] .unseen`);
	let count = el.html().trim();
	if(count == "")
		count = "0";
	let newCount = parseInt(count) + delta;
	if(newCount == 0)
		newCount = "";
	el.html(newCount);
} //}}}
function logNotification() { //{{{
	if(_notification === null) {
		$('#header .notification').css('background-color', '#a00');
		_notification = 'running';
		setTimeout(
			()=>{
				$('#header .notification').css(
					'background-color',
					'inherit',
				);
				_notification = null;
			},
			250,
		);
	}
} //}}}
function tailLog() { //{{{
	return $('#tail-log').is(":checked");
} //}}}
function showData(entryId) { //{{{
	$('#entry-data').html(_entries[entryId].Data);
	$('#entry-backtrace').html(_entries[entryId].Backtrace);
	$('#entry-info').html(`Entry added from <span class="remote-host">${_entries[entryId].RemoteHost}</span>`);
	$('.log-entry').removeClass('show');

	let el = $(`[x-entry-id=${entryId}]`);
	el.addClass('show');

	var pos = el.offset().top - el.height();
	if(!el.visible() || pos < el.height()) {
		el[0].scrollIntoView();
		pos = el.offset().top - el.height();
		if(pos < el.height())
			$('#entries')[0].scrollBy(0, (-1)*$('#entries').height()/2.0);
	}

	// Abort previous markSeen if any, as the timer didn't execute yet.
	// Message marked as seen after one second.
	if(_viewTimeout != null)
		clearTimeout(_viewTimeout);

	// No need to already mark a marked seen entry.
	entryId = parseInt(entryId);
	if(_entries[entryId] && _entries[entryId].Viewed)
		return;

	if(_entries[entryId] && _entries[entryId].Type == 'SEPARATOR')
		return;

	let req = {
		op: "SeenEntry",
		entryId: parseInt(entryId),
	};
	_viewTimeout = setTimeout(
		()=>socketSend(req),
		1000,
	);
} //}}}
function filter() { //{{{
	let f = $('#filter').val();
	$('.log-entry').removeClass('filtered');
	if(f != "")
		$(`.log-entry:not([x-filter*=${f}])`).addClass('filtered');
} //}}}

function getLayoutEntriesWidth() { //{{{
	let match = $('#layout')
		.css('grid-template-columns')
		.match(/\[entries\]\s*(\d+)/);

	if(match !== null)
		return match[1];
	return null;
} //}}}
function setLayoutEntriesWidth(width) { //{{{
	$('#layout').css(
		'grid-template-columns',
		`min-content [entries] ${width}px 3px 1fr`,
	);
} //}}}

function logout() { //{{{
	localStorage.removeItem('authenticationToken');
	location.href = 'login.html';
} //}}}

$(document).ready(()=>{
	socketConnect();
	document.onkeydown = keyHandler;

	new ClipboardJS('#entry-data-copy', {
		text: ()=>copyDataToClipboard()
	});

	new ClipboardJS('#entry-backtrace-copy', {
		text: ()=>copyBacktraceToClipboard()
	});

	new ClipboardJS('#copy-log-template', {
		text: ()=>{
			return JSON.stringify({
				systemId: parseInt(_menu_selected_id),
				type: "",
				context: "",
				data: "",
			}, null, 4);
		}
	});

	// Restore entries column width.
	let entriesWidth = localStorage.getItem('entriesWidth');
	if(entriesWidth)
		setLayoutEntriesWidth(entriesWidth);

	// Was backtrace showing or not?
	let backtrace = localStorage.getItem('backtrace');
	switch(backtrace) {
		case 'show': showBacktrace(); break;
		case 'hide': hideBacktrace(); break;
	}
});

// vim: foldmethod=marker
