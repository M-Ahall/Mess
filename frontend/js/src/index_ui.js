class UI {
	mess = null;
	currSystem = null;
	entrySelectFrom = 0;
	entrySelectTo = 0;
	hookEntryId = 0;
	notification = null;

	constructor(mess) {
		this.mess = mess;

		// Install keyboard shortcut handler
		document.onkeydown = evt=>this.keyHandler(evt);
	}

	socketClosed() { //{{{
		menuClose();
		$('#connection-closed').show();
	} //}}}
	keyHandler(evt) { //{{{
		// Preventing key events when in the filter text input is bad.
		if(evt.target.id == 'filter')
			return;

		let handled = true;
		switch(evt.key) {
			case "a":
				this.selectAllEntries();
				break;

			case "b":
				if(evt.ctrlKey) {
					let backtrace = $('#show-backtrace');
					backtrace.prop(
						'checked',
						!backtrace.is(':checked'),
					);
					this.toggleBacktrace();
				}
				break;

			case "m":
				this.mess.markSelectedEntriesSeen();
				break;

			case "s":
				this.mess.insertSeparator(this.currSystem);
				break;

			case "t":
				let tailLog = $('#tail-log');
				let state = !tailLog.is(':checked');
				tailLog.prop('checked', state)
				localStorage.setItem('tailLog', state);
				break;

			case "d":
			case "x":
			case "Delete":
				this.deleteSelectedEntries();
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

				mess.selectSystem(systemId);
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

				mess.selectSystem(systemId);
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
					this.clickEntry(evt, entryId);
				else {
					var entry = mess.entries[
						parseInt(entryId)
					];
					this.selectEntry(entry);
				}
				break;

			case "k":
			case "K":
			case "ArrowUp":
				// Find the previous element from currently
				// selected, and select that.
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
					this.clickEntry(evt, entryId);
				else {
					var entry = mess.entries[
						parseInt(entryId)
					];
					this.selectEntry(entry);
				}
				break;

			case "!":
				this.mess.toggleEntriesImportant();
				break;


			case 'g':
			case 'Home':
				var entryId = $('.log-entry:nth-child(2)')
					.attr('x-entry-id');
				if(entryId === undefined)
					break;
				entryId = parseInt(entryId);
				this.selectEntry(mess.entries[entryId]);
				break;

			case 'G':
			case 'End':
				var entryId = $('.log-entry:last-child')
					.attr('x-entry-id');
				if(entryId === undefined)
					break;
				entryId = parseInt(entryId);
				this.selectEntry(mess.entries[entryId]);
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

	// Initialization
	reset() { //{{{
		$('#groups').html('');
		$('#filter').val('');
		this.resetSystem();
		this.resetEntry();
	} //}}}
	resetSystem() { //{{{
		$('table.entries .log-entry').remove();
		$('#system-info').html('');
	} //}}}
	resetEntry() { //{{{
		$('#entry-data').html('');
		$('#entry-backtrace').html('');
		$('#entry-info').html('');
	} //}}}
	groupsInitialized() { //{{{
		// If GET parameters system_id and entry_id are set,
		// select the system and then the entry. Deep-linking.
		let params = new URLSearchParams(location.search);
		let systemId = parseInt(params.get('system_id'));
		let entryId = parseInt(params.get('entry_id'));
		if(systemId !== null && entryId !== null) {
			/* this.hookEntryId will select the entry
			 * when the entry is added after system entries are
			 * retrieved. */
			this.hookEntryId = entryId;
			let system = mess.systems[systemId];
			if(system === undefined)
				return;
			mess.selectSystem(systemId);
		}
	} //}}}
	clipboardInit() { //{{{
		new ClipboardJS('#entry-data-copy', {
			text: ()=>{
				let entryId = parseInt(
					$('.log-entry.show').attr('x-entry-id'),
				);
				if(entryId === undefined)
					return undefined;

				let entry = mess.entries[entryId];
				if(!entry)
					return undefined;

				return entry.data;
			}
		});

		new ClipboardJS('#entry-backtrace-copy', {
			text: ()=>{
				let entryId = parseInt(
					$('.log-entry.show').attr('x-entry-id'),
				);
				if(entryId === undefined)
					return undefined;

				let entry = mess.entries[entryId];
				if(!entry)
					return undefined;

				return entry.backtrace;
			}
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

		new ClipboardJS('#copy-entry-link', {
			text: ()=>{
				var entryId = parseInt(_menu_selected_id);
				var entry = mess.entries[entryId];
				var url = `${location.protocol}://`+
					`${location.host}/`
				url += `?system_id=${entry.system.id}`+
					`&entry_id=${entry.id}`;
				return url;
			}
		});
	} //}}}
	restoreApplicationState() { //{{{
		// Restore entries column width.
		let entriesWidth = localStorage.getItem('entriesWidth');
		if(entriesWidth)
			this.setLayoutEntriesWidth(entriesWidth);

		// Was backtrace showing or not?
		let backtrace = localStorage.getItem('backtrace');
		switch(backtrace) {
			case 'show': this.showBacktrace(); break;
			case 'hide': this.hideBacktrace(); break;
		}

		// Restore tail log state
		let tailLog = $('#tail-log');
		var state = localStorage.getItem('tailLog');
		if(state !== null)
			tailLog.prop('checked', state == 'true')

		// Restore date state
		let showDate = $('#show-date');
		state = localStorage.getItem('showDate');
		if(state !== null) {
			showDate.prop('checked', state == 'true')
			this.toggleDate();
		}
	} //}}}

	// Group management
	addGroup(newGroup) { //{{{
		// Place group in the correct, alphabetical place.
		var placeBefore = null;
		var newName = newGroup.name.toLowerCase();

		$('#groups .group .name').each((_, group)=>{
			if(newName < group.innerHTML.toLowerCase()) {
				placeBefore = group;
				return false;
			}
		});

		// Place last.
		let div = `<div
				class='group'
				x-group-id="${newGroup.id}"
				x-menu-id="${newGroup.id}"
				onClick="menuShow('group', event); return false;"
				onContextMenu="menuShow('group', event); return false;"
			>
				<div class="name">${newGroup.name}</div>
			</div>`;
		if(placeBefore === null)
			$('#groups').append(div);
		else {
			$(placeBefore).parent().before(div);
		}
	} //}}}
	deletedGroup(group) { //{{{
		$(`.group[x-group-id=${group.id}]`).remove();
	} //}}}
	renameGroup() { //{{{
		let name = prompt("New group name:");
		if(name === null)
			return null;
		name = name.trim();

		let res = {
			group: mess.groups[parseInt(_menu_selected_id)],
			name: name,
		}
		return res;
	} //}}}

	// System management
	addSystem(newSystem) { //{{{
		// Place group in the correct, alphabetical place.
		var placeBefore = null;
		var newName = newSystem.name.toLowerCase();

		let systems = $(`#groups .system[x-group-id=${newSystem.group.id}] .name`);
		systems.each((_, system)=>{
			if(newName < system.innerHTML.toLowerCase()) {
				placeBefore = system;
				return false;
			}
		});

		let div = `<div
			class='system'
			x-group-id='${newSystem.group.id}'
			x-system-id='${newSystem.id}'
			x-menu-id='${newSystem.id}'
			onClick='mess.selectSystem(${newSystem.id})'
			onContextMenu="menuShow('system', event); return false;"
		>
			<div class='name'>${newSystem.name}</div>
			<div class='unseen'>${newSystem.unseenEntries ? newSystem.unseenEntries : ''}</div>
		</div>`;

		// Place last.
		if(placeBefore === null) {
			if(systems.length == 0)
				$(`.group[x-group-id=${newSystem.group.id}]`).after(div);
			else
				$(`.system[x-group-id=${newSystem.group.id}]`).last().after(div);
		} else {
			$(placeBefore).parent().before(div);
		}
	} //}}}
	selectSystem(system) { //{{{
		document.title = `${system.name} - Mess`;
		$('[x-system-id]').removeClass('selected');
		$(`[x-system-id=${system.id}]`).addClass('selected');

		this.resetSystem();
		this.resetEntry();
		$('#system-info').html(system.id);

		// System entries are added one by one and changing the unseen entries
		// count. Resetting system count first makes it right.
		$(`[x-system-id=${system.id}] .unseen`).html('');
	} //}}}
	deletedSystem(system) { //{{{
		if(this.currSystem && this.currSystem.id == system.id) {
			this.resetSystem();
			this.currSystem = null;
			document.title = 'Mess';
		}
		$(`.system[x-system-id=${system.id}]`).remove();
	} //}}}
	createSystem() { //{{{
		let name = prompt("System name:");
		if(name === null)
			return null;
		name = name.trim();

		let res = {
			group: mess.groups[parseInt(_menu_selected_id)],
			name: name,
		}
		return res;
	} //}}}
	deleteSystem() { //{{{
		let system = mess.systems[_menu_selected_id];
		if(!confirm(`Are you sure that you want to delete ${system.name}?`))
			return null;
		return system;
	} //}}}
	renameSystem() { //{{{
		let name = prompt("New system name:");
		if(name === null)
			return;
		name = name.trim();
		let system = mess.systems[parseInt(_menu_selected_id)];
		let res = {
			system: system,
			name: name,
		}
		return res;
	} //}}}

	// Entry management
	addEntry(entry) { //{{{
		if(entry.type == 'SEPARATOR')
			$('table.entries tr:first-child').after(`
				<tr
					class="log-entry separator"
					x-entry-id="${entry.id}"
					onClick="clickEntry(event, ${entry.id})"
				>
					<td colspan=5></td>
				</tr>
			`);
		else {
			let filter = (entry.type+' '+entry.context).toLowerCase();
			$('table.entries tr:first-child').after(`
				<tr
					class="log-entry ${entry.viewed ? '' : 'new'} ${entry.important ? 'important' : ''}"
					x-entry-id="${entry.id}"
					x-menu-id="${entry.id}"
					x-filter="${filter}"
					onClick="mess.ui.clickEntry(event, ${entry.id})"
					onContextMenu="menuShow('entry', event); return false;"
				>
					<td>${entry.id}</td>
					<td>${entry.date}</td>
					<td>${entry.time}</td>
					<td>${entry.type ? entry.type : '&nbsp;'}</td>
					<td>${entry.context ? entry.context : '&nbsp'}</td>
				</tr>
			`);
		}

	} //}}}
	clickEntry(evt, entryId) { //{{{
		let entry = mess.entries[entryId];
		if(!evt.shiftKey)
			this.selectEntry(entry);

		if(evt.shiftKey && this.entrySelectFrom !== null) {
			let entries = $('table.entries [x-entry-id]');
			entries.removeClass('selected');
			let idxA = entries.index($(`table.entries [x-entry-id=${this.entrySelectFrom}]`));
			let idxB = entries.index($(`table.entries [x-entry-id=${entry.id}]`));
			let from = Math.min(idxA, idxB);
			let to   = Math.max(idxA, idxB);

			for(var i = from; i <= to; i++) {
				$(entries[i]).addClass('selected');
			}
		}

		this.selectEntry(entry, true);
	} //}}}
	selectEntry(entry, onlyShowData) { //{{{
		if(!onlyShowData) {
			this.entrySelectFrom = entry.id;
			$('.log-entry[x-entry-id]').removeClass('selected');
			$(`.log-entry[x-entry-id=${entry.id}]`).addClass('selected');
		}
		this.displayEntry(entry);
	} //}}}
	displayEntry(entry) { //{{{
		$('#entry-data').html(entry.data);

		$('#entry-backtrace').html(entry.backtrace);
		$('#entry-info').html(`Entry added from <span class="remote-host">${entry.remoteHost}</span>`);
		$('.log-entry').removeClass('show');

		let el = $(`[x-entry-id=${entry.id}]`);
		el.addClass('show');

		var pos = el.offset().top - el.height();
		if(!el.visible() || pos < el.height()) {
			el[0].scrollIntoView();
			pos = el.offset().top - el.height();
			if(pos < el.height())
				$('#entries')[0].scrollBy(0, (-1)*$('#entries').height()/2.0);
		}

		// Highlight data
		// TODO - a setting for automatically highlighting data or not.
		hljs.highlightElement($('#entry-data')[0]);
		hljs.highlightElement($('#entry-backtrace')[0]);

		// Abort previous markSeen if any, as the timer didn't execute yet.
		// Message marked as seen after one second.
		if(_viewTimeout != null)
			clearTimeout(_viewTimeout);

		// No need to already mark a marked seen entry.
		if(entry.viewed)
			return;

		if(entry.type == 'SEPARATOR')
			return;

		let req = {
			op: "SeenEntry",
			entryId: entry.id,
		};
		_viewTimeout = setTimeout(
			()=>this.mess.socket.send(req),
			1000,
		);
	} //}}}
	updateSeenEntries(entry, op) { //{{{
		if(entry.type == 'SEPARATOR')
			return;

		// This will happen when seen-marking an already seen entry.
		if(entry.system.id == 0)
			return;

		let delta = 0;
		switch(op) {
			case 'add':
				if(entry.viewed)
					return;
				delta = 1;
				break;

			case 'seen':
				$(`[x-entry-id=${entry.id}]`)
					.removeClass('new');
				if(!entry.viewed)
					delta = -1;
				break;

			case 'deleted':
				if(entry.viewed)
					return;
				delta = -1;
				break;
		}

		let el = $(`.system[x-system-id=${entry.system.id}] .unseen`);
		let count = el.html().trim();
		if(count == "")
			count = "0";
		let newCount = parseInt(count) + delta;
		if(newCount == 0)
			newCount = "";
		el.html(newCount);
	} //}}}
	markSelectedEntriesSeen() { //{{{
		let entryElements = $('table.entries .log-entry.selected');
		let entryId = 0;
		let entries = [];
		var entry;
		entryElements.each((_, entryElement)=>{
			entryId = parseInt($(entryElement).attr('x-entry-id'));
			entry = this.mess.entries[entryId];
			// No need to send a mark-seen-request to server for an
			// already seen entry.
			if(entry.viewed)
				return;
			entries.push(entry);
		});
		return entries;
	} //}}}
	deleteSelectedEntries() { //{{{
		let entryElements = $('.log-entry.selected');
		entryElements.each((_, entry)=>{
			var entryId = parseInt($(entry).attr('x-entry-id'));
			var entry = mess.entries[entryId];
			this.mess.deleteEntry(entry);
		});
	} //}}}
	deletedEntry(entry) { //{{{
		// Empty entry data field if entry to be deleted is the
		// one currently showing.
		if(entry.id == $('.log-entry.show').attr('x-entry-id'))
			this.resetEntry();

		let el = $(`[x-entry-id=${entry.id}]`);
		if(el.hasClass('show')) {
			let next = el.next('.log-entry');
			let prev = el.prev('.log-entry');
			if(next.length > 0) {
				var entry = mess.entries[
					parseInt(next.attr('x-entry-id'))
				];
				this.selectEntry(entry);
			} else if(prev.length > 0) {
				var entry = mess.entries[
					parseInt(prev.attr('x-entry-id'))
				];
				this.selectEntry(entry);
			}
		}
		el.remove();
	} //}}}
	toggleEntriesImportant() { //{{{
		let entries = [];
		$('.log-entry.selected').each((_, el)=>{
			var entryId = $(el).attr('x-entry-id');
			if(entryId === undefined)
				return;
			entryId = parseInt(entryId);
			var entry = mess.entries[entryId];
			if(entry.type == 'SEPARATOR')
				return;
			entries.push(entry);
		});
		return entries;
	} //}}}
	updateImportantState(entry) { //{{{
		let el = $(`.log-entry[x-entry-id=${entry.id}]`);
		if(entry.important)
			el.addClass('important');
		else
			el.removeClass('important');
	} //}}}

	// UI functions
	logout() { //{{{
		localStorage.removeItem('authenticationToken');
		location.href = 'login.html';
	} //}}}
	selectAllEntries() { //{{{
		$('table.entries [x-entry-id]').addClass('selected');
	} //}}}
	filter() { //{{{
		let f = $('#filter').val().toLowerCase().replaceAll('"', '\\"');
		$('.log-entry').removeClass('filtered');
		if(f != "")
			$(`.log-entry:not([x-filter*="${f}"])`).addClass(
				'filtered',
			);
	} //}}}
	logNotification() { //{{{
		if(this.notification === null) {
			$('#header .notification').css(
				'background-color',
				'#a00',
			);
			this.notification = 'running';
			setTimeout(
				()=>{
					$('#header .notification').css(
						'background-color',
						'inherit',
					);
					this.notification = null;
				},
				250,
			);
		}
	} //}}}

	toggleDate() { //{{{
		let checked = $('#show-date').is(':checked');
		if(checked)
			$('table.entries').addClass('date');
		else
			$('table.entries').removeClass('date');
		localStorage.setItem('showDate', checked);
	} //}}}

	toggleBacktrace() { //{{{
		let checked = $('#show-backtrace').is(':checked');
		if(checked)
			this.showBacktrace();
		else
			this.hideBacktrace();
	} //}}}
	showBacktrace() { //{{{
		$('#layout').removeClass('without-backtrace');
		$('#entry-backtrace').show();
		$('#entry-backtrace-copy').show();

		// Backtrace restore runs this function and needs the checkbox to
		// correspond to the backtrace state.
		$('#show-backtrace').prop('checked', true);

		// Backtrace status is restored on page load.
		localStorage.setItem('backtrace', 'show');
	} //}}}
	hideBacktrace() { //{{{
		$('#layout').addClass('without-backtrace');
		$('#entry-backtrace').hide();
		$('#entry-backtrace-copy').hide();

		// Backtrace restore runs this function and needs the checkbox to
		// correspond to the backtrace state.
		$('#show-backtrace').prop('checked', false);

		// Backtrace status is restored on page load.
		localStorage.setItem('backtrace', 'hide');
	} //}}}

	resizeEntriesStart() { //{{{
		_resizeEntries = true;
		$('#layout').on('mousemove', evt=>this.resizeEntries(evt));
	} //}}}
	resizeEntries(evt) { //{{{
		if(!_resizeEntries)
			return;

		let el = $('#entries');
		let newPos = Math.round(evt.clientX - el.offset().left - 1);
		this.setLayoutEntriesWidth(newPos);
		evt.preventDefault();
	} //}}}
	resizeEntriesStop() { //{{{
		_resizeEntries = false;
		$('#layout').off('mousemove');

		let width = this.getLayoutEntriesWidth();
		if(width !== null)
			localStorage.setItem('entriesWidth', width);
	} //}}}
	getLayoutEntriesWidth() { //{{{
		let match = $('#layout')
			.css('grid-template-columns')
			.match(/\[entries\]\s*(\d+)/);

		if(match !== null)
			return match[1];
		return null;
	} //}}}
	setLayoutEntriesWidth(width) { //{{{
		$('#layout').css(
			'grid-template-columns',
			`min-content [entries] ${width}px 3px 1fr`,
		);
	} //}}}

	// State functions
	tailLog() { //{{{
		return $('#tail-log').is(":checked");
	} //}}}
	storeTailLogState() { //{{{
		let tailLog = $('#tail-log');
		let state = tailLog.is(':checked');
		localStorage.setItem('tailLog', state);
	} //}}}
}

// vim: foldmethod=marker
