var _menu_selected_id = null;

function menuShow(name, pointerEvt) { //{{{
	// Find the ID associated with the clicked item.
	// This is later accessed from the menu item functions.
	let id = $(event.target).closest('[x-menu-id]').attr('x-menu-id');
	if(id === undefined) {
		alert('Could not find the x-menu-id attribute.');
		return;
	}
	_menu_selected_id = id;

	let menuEl = $(`.menu[x-menu="${name}"]`);
	$('.menu-blackout').show();
	menuEl.css('left', pointerEvt.clientX + 10);
	menuEl.css('top', pointerEvt.clientY - 10);
	menuEl.show();
} //}}}

async function menuClose() { //{{{
	// Chrome doesn't have time to hide the elements
	// properly, waiting 100 ms seems to be enough :'(
	let timeout = new Promise((resolve, _)=>{
		setTimeout(()=>resolve(), 75);
	});

	let blackout = new Promise((resolve, _)=>{
		$('.menu-blackout').hide(0, ()=>resolve());
	});
	let menu = new Promise((resolve, _)=>{
		$('.menu[x-menu]').hide(0, ()=>resolve());
	});

	return Promise.all([timeout, blackout, menu]);
} //}}}

$(document).ready(()=>{
	//$('.menu[x-menu]').append('<div class="close" onClick="menuClose()">Close</div>');
	$('body').append('<div class="menu-blackout" onClick=\"menuClose()\"></div>');
});

// vim: foldmethod=marker
