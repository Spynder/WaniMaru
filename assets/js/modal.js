function getCookie(name) { // https://stackoverflow.com/a/15724300/9741568
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) return parts.pop().split(';').shift();
}

$(document).ready(function() {
	let apiModal = $("#apiModal");
	let modalClose = $("#close");
	let apiBtn = $("#apiBtn");
	let sendKey = $("#sendKey");
	let keyInput = $("#keyInput");

	apiModal.hide();
	
	apiBtn.click(function() {
		apiModal.toggle();
	});
	modalClose.click(() => apiModal.hide());

	if(!getCookie("apikey")) {
		apiModal.show();
	}

	sendKey.click(function() {
		let d = new Date(); // https://www.w3schools.com/js/js_cookies.asp
		d.setTime(d.getTime() + (365*24*60*60*1000)) // 1 year
		document.cookie = "apikey=" + keyInput.val() + "; expires=" + d.toUTCString() + "; path=/";
		document.location.reload();
	});
})