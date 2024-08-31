const SCALE = (window.innerHeight-150)/1000;

const SIZE = 1000*SCALE;
const CENTER = SIZE/2;
const CIRCLE_COLORS = ["#F400A3", "#DF0DA9", "#CA1AAF", "#B527B4", "#A034BA", "#A034BA", "#734DCD", "#4665DF", "#00a0f1", "#4d4d4d"];
const SUBJECT_COLORS = {"radical": "#008ad1", "kanji": "#eb009c", "vocabulary": "#a300f5", "burned": "#3f3f3f"};
const CIRCLE_CENTER_SIZE = 60*SCALE;
const CIRCLE_OFFSET = 45*SCALE;
const CIRCLE_WIDTH = 12*SCALE;
const ITEM_WIDTH = 14*SCALE;
const STACK_POWER = 3*SCALE;
const COLOR_MAX_DELTA = 30;
const INFO_MAXHEIGHT = 500;
const INFO_XOFFSET = 30;
const ITEM_HEIGHT = 30;

// API communication methods
let token;
async function fetchData(url, strName) {
	try {
		data = await $.ajax({
			url: url,
			headers: {"Authorization": "Bearer " + token}
		});
		return data;
	} catch(e) {
		$("#err").show().text(`Error occured while fetching ${strName}. Please check your API key.`);
		console.error(e);
	}
}

async function getAllAssignments() {
	let assignments = [[], [], [], [], [], [], [], [], [], []]; // For every SRS level
	const now = Date.now();
	let res;
	do {
		res = await fetchData(res ? res.pages.next_url : "https://api.wanikani.com/v2/assignments", "assignments");
		res.data.forEach(function(assignment) {
			if(assignment.data.hasOwnProperty("available_at") || assignment.data.hasOwnProperty("burned_at")) {
				let at;
				if(assignment.data.available_at) {
					at = Date.parse(assignment.data.available_at);
					assignment.seconds_until = Math.max(0, (at - now)/1000);
				}
				else {
					at = Date.parse(assignment.data.burned_at);
					assignment.seconds_until = Math.floor((now - at)/(1000*60*60*24));
				}
			}
			assignments[assignment.data.srs_stage].push(assignment);
		})
	} while(res.pages.next_url);

	for (let stage_num = 1; stage_num < 10; stage_num++) { // Don't sort stages 0 and 9 (Lesson and Burned), as they have no "available_at" property
		assignments[stage_num].sort((a,b) => b.seconds_until - a.seconds_until);
	}
	return assignments;
}

async function fillUser() {
	let user = await fetchData("https://api.wanikani.com/v2/user", "user data");
	$("#name").html(`Logged in as<span class="name">${user.data.username}</span>`);
}


// Color transformation methods
function rgbToHex(r, g, b) {
	return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function hexToRgb(hex) {
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16)
	} : null;
}


// Draw methods
let ctx;
function drawItem(x, y, rot, size, color) {
	ctx.beginPath();
	ctx.moveTo(x - size * Math.cos(rot - Math.PI), y - size * Math.sin(rot - Math.PI));
	ctx.lineTo(x - size * Math.cos(rot - Math.PI/3), y - size * Math.sin(rot - Math.PI/3));
	ctx.lineTo(x, y);
	ctx.lineTo(x - size * Math.cos(rot + Math.PI/3), y - size * Math.sin(rot + Math.PI/3));
	ctx.lineTo(x - size * Math.cos(rot - Math.PI), y - size * Math.sin(rot - Math.PI));
	ctx.fillStyle = color;
	ctx.fill();
	let strokeColor = hexToRgb(color);
	ctx.strokeStyle = rgbToHex(Math.min(255, strokeColor.r+150), Math.min(255, strokeColor.g+150), Math.min(255, strokeColor.b+150));
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.closePath();
}

function drawText(size, color, text, x, y, align) {
	ctx.textBaseline = 'middle';
	ctx.font = size*SCALE + "px Helvetica"
	ctx.fillStyle = color;
	if(align) {
		ctx.textAlign = align;
	}
	ctx.strokeStyle = "#000";
	ctx.fillText(text, x, y);
}

function drawCircle(x, y, radius, color, stroke, lineWidth) {
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, 2*Math.PI);
	if(stroke) {
		ctx.strokeStyle = color;
		if(lineWidth) {
			ctx.lineWidth = lineWidth;
		}
		ctx.stroke();
	} else {
		ctx.fillStyle = color;
		ctx.fill();
	}
	ctx.closePath();
}


// Draw circle functions
function drawBase() {
	for (let i = 1; i < 10; i++) {
		drawCircle(CENTER, CENTER, CIRCLE_CENTER_SIZE+i*CIRCLE_OFFSET, CIRCLE_COLORS[i], true, CIRCLE_WIDTH);
	}
	ctx.clearRect(CENTER-1, 0, 2, CENTER);
	drawCircle(CENTER, CENTER, CIRCLE_CENTER_SIZE, CIRCLE_COLORS[0]);
}

let drawnItems = []; // For info block to connect
async function drawItems(redraw) {
	function drawnItem(x,y,srs,ids,color,seconds_until) { // class
		return {x,y,srs,ids,color,seconds_until};
	}

	let assignments = getAllAssignments();
	let timers = fetchData("https://api.wanikani.com/v2/spaced_repetition_systems/1", "timers");

	assignments = await assignments;
	timers = (await timers).data.stages;

	if(redraw) {
		ctx.clearRect(0, 0, SIZE, SIZE);
		drawBase();
	}

	drawnItems = [];
	drawnItems.push(drawnItem(CENTER, CENTER, 0, assignments[0].map((assignment => assignment.data.subject_id)), undefined, 0)); // Center lessons
	drawText(48, "#FFFFFF", assignments[0].length, CENTER, CENTER-5*SCALE, "center");
	drawText(20, "#FFFFFF", "lessons", CENTER, CENTER+25*SCALE, "center");

	function getItemTransform(indices, item, burned_angle=0) {
		let stage_num = item.data.srs_stage;
		let radius = CIRCLE_CENTER_SIZE+stage_num*CIRCLE_OFFSET;
		let angle = (item.seconds_until*2*Math.PI)/timers[stage_num].interval - Math.PI/2;
		if(stage_num==9) {
			angle = 2*Math.PI*burned_angle - Math.PI/2;
		}


		// Decide color. There's probably a cleaner solution, but this is good enough.
		// Color gets decided based on subject type quantity.
		let colorName = "radical";
		if(stage_num!=9) {
			colorName = "radical";
			let radicals = indices.filter(i => assignments[stage_num][i].data.subject_type == "radical").length;
			let kanjis = indices.filter(i => assignments[stage_num][i].data.subject_type == "kanji").length;
			let vocab = indices.filter(i => assignments[stage_num][i].data.subject_type == "vocabulary").length;
			if(kanjis >= radicals && kanjis >= vocab) colorName = "kanji";
			if(vocab >= radicals && vocab >= kanjis) colorName = "vocabulary";
		} else {
			colorName = "burned";
		}

		return {
			x: CENTER + Math.cos(angle)*radius,
			y: CENTER + Math.sin(angle)*radius,
			rot: angle-Math.PI/2,
			size: ITEM_WIDTH + Math.sqrt(indices.length*STACK_POWER),
			colorName: colorName
		};
	}
	
	let unique_burns_count = new Set(assignments[9].map(assignment => assignment.seconds_until)).size;
	for (let stage_num = 1; stage_num < 10; stage_num++) {
		if(!assignments[stage_num].length) continue;
		let indices = [];
		let subjects = [];
		let seconds_last = -1;
		let marker_index = 0
		for(let index in assignments[stage_num]) {
			index = Number(index); // Why tf is it string not num? Whatever
			let currItem = assignments[stage_num][index];
			if(!indices.length) seconds_last = currItem.seconds_until;
			if(currItem.seconds_until == seconds_last) { // Always happens at first loop
				indices.push(index);
				subjects.push(currItem.data.subject_id);
			}
			if(  index+1 == assignments[stage_num].length || // Last element
				(index+1 < assignments[stage_num].length && assignments[stage_num][index+1].seconds_until != currItem.seconds_until)) { // New element is of different timing
				let transform = getItemTransform(indices, currItem, marker_index/unique_burns_count);
				marker_index++;
				drawItem(transform.x, transform.y, transform.rot, transform.size, SUBJECT_COLORS[transform.colorName])
				drawnItems.push(drawnItem(transform.x, transform.y, stage_num, subjects, transform.colorName, seconds_last));

				indices = [];
				subjects = [];
			}
		}
	}
}

function getCookie(name) { // https://stackoverflow.com/a/15724300/9741568
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) return parts.pop().split(';').shift();
}
let boundTo;
$(document).ready(async function() {
	let canvas = document.getElementById("can");
	ctx = canvas.getContext("2d");
	token = getCookie("apikey");
	canvas.height = SIZE;
	canvas.width = SIZE;
	let infoBlock = $("#info");
	infoBlock.css({"max-height": INFO_MAXHEIGHT});
	
	drawBase();
	if(!token) {
		drawText(36, "#FFFFFF", "No", CENTER, CENTER-18*SCALE, "center");
		drawText(36, "#FFFFFF", "key!", CENTER, CENTER+18*SCALE, "center");	
		return;
	}
	fillUser();
	drawItems();

	setInterval(function() {
		drawItems(true);
	}, 60*1000); // Update every minute


	// Handle canvas clicks

	document.addEventListener("click", checkItemClicks, false);
	function getMousePos(event) {
		let rect = canvas.getBoundingClientRect();
		return {
			x: (event.clientX - rect.left),
			y: (event.clientY - rect.top)
		};
	}
	function isInside(pos, obj, radius) {
		return Math.sqrt((pos.x-obj.x)**2 + (pos.y-obj.y)**2) < radius;
	}

	async function checkItemClicks(event) {
		if(event.composedPath().findIndex(el => el.id == "info" || el.id == "apiModal") !== -1) return; // If clicked on info or modal is on don't propagate
		let pos = getMousePos(event);
		let clickedItem;
		for (let i in drawnItems) {
			let item = drawnItems[i];
			let radius = i==0 ? CIRCLE_CENTER_SIZE : (ITEM_WIDTH+STACK_POWER)/1.5
			if(isInside(pos, item, radius)) {
				clickedItem = item;
				break;
			}
		}
		if(clickedItem) {
			boundTo = clickedItem;
			function generateInfoHeader(boundTo) {
				let hours_until = Math.ceil(boundTo.seconds_until/3600);
				let srsString = ["Lesson", "Apprentice 1", "Apprentice 2", "Apprentice 3", "Apprentice 4", "Guru 1", "Guru 2", "Master", "Enlightened", "Burned"][boundTo.srs];
				let timeString = hours_until < 24 ? `${hours_until} hours` : `${Math.ceil(hours_until/24)} days`;
				let timer = `Incoming in <span class="highlight">${timeString}</span>`;
				if(!hours_until) timer = `<span class="highlight">Already waiting for you!</span>`;
				if(boundTo.srs==9) {
					timer = `Burned ${Math.floor(boundTo.seconds_until)} days ago`;
				}

				return $(`
					<div class="header">
						<p class="srs">SRS stage: ${srsString}</p>
						<p class="timer">${timer}</p>
					</div>
				`);
			}
			
			function generateInfoItem(subject) {
				let text = subject.data.characters;
				if(!text) text = `<img src="${subject.data.character_images.find(img => img.metadata.dimensions == "64x64").url}">`;
				return $(`<a class="item ${subject.object}" href="${subject.data.document_url}">${text}</a>`);
			}

			infoBlock.empty().removeClass().addClass(boundTo.color).append(generateInfoHeader(boundTo)).show();
			moveInfo();

			let subjects = await fetchData("https://api.wanikani.com/v2/subjects?ids=" + boundTo.ids.join(), "subjects");
			subjects.data.sort(function(a,b) {
				let typeA = a.object;
				let typeB = b.object;
				const order = {radical: 0, kanji: 1, vocabulary: 2};
				return order[typeA] - order[typeB];
			});
			subjects.data.forEach(function(subject) {
				infoBlock.append(generateInfoItem(subject));
			});
			moveInfo();
		} else {
			infoBlock.hide();
			boundTo = undefined;
		}
	}
});

$(window).resize(moveInfo);
function moveInfo() {
	if(!boundTo) return;
	let infoBlock = $("#info");
	let rect = document.getElementById("can").getBoundingClientRect();
	let centerX = boundTo.x + rect.left;
	let centerY = boundTo.y + rect.top;
	infoBlock.css("left", centerX + INFO_XOFFSET);
	infoBlock.css("top", Math.max(50, Math.min(window.innerHeight - infoBlock.height() - 50, centerY - infoBlock.height()/2)));
}