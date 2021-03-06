var d = 200;
var BREED = .3;
var ATTRACTOR_RADIUS = 30;
var ATTRACT = 0.1;
var REPEL = -0.5;
var CHILD_AGE = 100;
var DEATH_AGE = 0;
var ATTRACTOR_DEATH_AGE = 750;
var LAST_BREED = 1500;
var LAST_MOVE = 30;
var INITIAL_AGENTS = .005;
var DRAW_ATTRACTORS = true;
var ATTRACTOR_MODE = ATTRACT;
var ATTRACTOR_COLOR = 0;
var grid = [];
var agents = [];
var attractors = {};
var attractorGrids = {};
var scaleFactor = d/600; //600 hardcoded since it's in the CSS
var COLOR_A, COLOR_B;
var imageData;
var scoreSpan = document.getElementById("score");
var canPlaceAttractor = true;
var attractorCooldown = 0;
var MAX_ATTRACTOR_COOLDOWN = 30;
var currentPip = 0;
var newestAttractor;
var gameDuration;
var gameStartTime;
var JOIN_WAIT = 15;
var imageChoices = [
	"images/a.png",
	"images/b.png",
	"images/c.png",
	"images/d.png",
	"images/e.png",
	"images/f.png",
	"images/g.png",
	"images/h.png",
	"images/i.png",
	"images/j.png",
	"images/k.png",
	"images/l.png",
	"images/m.png",
	"images/n.png",
	"images/o.png"
];
var gameSeed = 0;

var sketch = new Processing("canvas");

var setupGUI = function(parent) {
	return;
	var gui = new dat.GUI();
	gui.add(parent, "BREED", 0, 1);
	gui.add(parent, "ATTRACTOR_RADIUS", 10, 120);
	gui.add(parent, "ATTRACT", 0, 5);
	gui.add(parent, "REPEL", -5, 0);
	gui.add(parent, "CHILD_AGE", 5, 1000);
	gui.add(parent, "DEATH_AGE", 0, 20000);
	gui.add(parent, "ATTRACTOR_DEATH_AGE", 0, 5000);
	gui.add(parent, "LAST_BREED", 100, 3000);
	gui.add(parent, "LAST_MOVE", 20, 100);
	gui.add(parent, "DRAW_ATTRACTORS");
}

var switchAttractorMode = function(mode, color) {
	ATTRACTOR_MODE = mode;
	ATTRACTOR_COLOR = color;
};

Array.prototype.slice.call(document.getElementsByTagName("button")).forEach(function(button) {
	button.onclick = function() {
		switch(button.id) {
			case "ba":
				switchAttractorMode(ATTRACT, 0);
				break;
			case "br":
				switchAttractorMode(REPEL, 0);
				break;
			case "ra":
				switchAttractorMode(ATTRACT, 1);
				break;
			case "rr":
				switchAttractorMode(REPEL, 1);
				break;
			default:
				break;
				//pass
		}
	};
});

var initGame = function(gameState, socket) {
	// Inject Image and wait for it to load
	var img = document.createElement("img");
	img.className = "main";
	img.id = "mandrill";
	img.src = gameState.image;
	img.onload = function() {
		startGame(gameState, socket);
	};

	$(".error").hide();

	$("#game img.main").remove();
	$("#canvas").after(img);

	$("form.join").show();
	$("div.waiting").hide();

	$("#join").hide();
	$("#game").show();
};

window.onload = function() {
	setupGUI(this);

	if (typeof io !== "undefined") {
		var socket = io.connect('http://' + window.location.host);
		var gameState;
		var gameWait;

		// Don't start game until gameConnect occurs
		socket.on('gameConnect', function(data) {
			gameState = data;

			$("form.join").hide();
			$("div.waiting").show();

			var totalTime = JOIN_WAIT;

			gameWait = setInterval(function() {
				totalTime -= 1;

				$("#waittime").text(totalTime);

				if (totalTime <= 0) {
					// Force the game to start
					socket.emit("gameStart");
				}
			}, 1000);
		});

		// Don't start game until gameStart occurs
		socket.on('gameStart', function() {
			if (gameWait) {
				clearTimeout(gameWait);
				gameWait = null;
				$("#waittime").text(JOIN_WAIT);
			}
			initGame(gameState, socket);
		});

		// Handle error connecting
		socket.on('error', function(data) {
			// TODO: Let them know when to reconnect
			$("p.error").text(data.msg).show();
		});
	}

	// Add button to click to start/join a new game
	$("form.join").submit(function() {
		if (typeof socket !== "undefined") {
			socket.emit("joinGame");
		} else {
			// We're playing a single-player game!
			initGame({
				image: imageChoices[Math.floor(Math.random() * imageChoices.length)],
				seed: Math.random(),
				duration: 60 * 1000
			});
		}

		return false;
	});

	// Dump players back to join screen on game over
	$("form.startover").submit(function() {
		$("div.scores").hide();
		$("div.overwait").show();

		$("#gameover").hide();
		$("#join").show();

		return false;
	});
};
var resetPips = function() {
	currentPip = 0;
	Array.prototype.slice.call(document.querySelectorAll(".pip.on")).forEach(function(pip) {
		pip.className = "pip";
	});
}
var checkPips = function() {
	if (!gameDuration) {
		return;
	}
	var progress = (new Date() - gameStartTime)/gameDuration;
	var pip = Math.floor(progress * 8);
	if (currentPip < pip) {
		document.querySelector("#pip" + pip).className = "pip on";
		currentPip = pip;
	}
}
// Create a random number generator

// A seeded random number generator for dropping random,
// but consistent, tiles
var seededRandom = function() {
    // Robert Jenkins' 32 bit integer hash function.
    // JS implementation from V8 benchmark
    var seed = gameSeed;

    seed = ((seed + 0x7ed55d16) + (seed << 12))  & 0xffffffff;
    seed = ((seed ^ 0xc761c23c) ^ (seed >>> 19)) & 0xffffffff;
    seed = ((seed + 0x165667b1) + (seed << 5))   & 0xffffffff;
    seed = ((seed + 0xd3a2646c) ^ (seed << 9))   & 0xffffffff;
    seed = ((seed + 0xd3a2646c) ^ (seed << 9))   & 0xffffffff;
    seed = ((seed + 0xfd7046c5) + (seed << 3))   & 0xffffffff;
    seed = ((seed ^ 0xb55a4f09) ^ (seed >>> 16)) & 0xffffffff;

	gameSeed = (seed & 0xfffffff);
	return gameSeed / 0x10000000;
};

var startGame = function(gameState, socket) {
	grid = [];
	agents = [];
	attractors = {};
	attractorGrids = {};

	// Seed the random number generator
	gameSeed = gameState.seed;
	gameStartTime = new Date();
	resetPips();
	with(sketch) {
	var directions = [
		{ x: -1, y: -1 },
		{ x: 0, y: -1 },
		{ x: 1, y: -1 },

		{ x: -1, y: 0 },
		//{ x: 0, y: 0 },
		{ x: 1, y: 0 },

		{ x: -1, y: 1 },
		{ x: 0, y: 1 },
		{ x: 1, y: 1 }
	];
	COLOR_A = color(191, 40, 34);//"#bf2822";
	COLOR_B = color(34, 185, 191);//"#22b9bf";

	var addGrid = function(obj, doKill) {
		var startX = obj.x - floor(obj.width / 2);
		var endX = obj.x + floor(obj.width / 2);
		var startY = obj.y - floor(obj.height / 2);
		var endY = obj.y + floor(obj.height / 2);

		for (var x = startX; x <= endX; x++) {
			for (var y = startY; y <= endY; y++) {
				var pos = (x * width) + y;
				if (doKill && grid[pos]) {
					grid[pos].kill();
				}
				grid[pos] = obj;
			}
		}
	};

	var removeGrid = function(obj, x, y) {
		x = x || obj.x;
		y = y || obj.y
		var startX = x - floor(obj.width / 2);
		var endX = x + floor(obj.width / 2);
		var startY = y - floor(obj.height / 2);
		var endY = y + floor(obj.height / 2)

		for (var x = startX; x <= endX; x++) {
			for (var y = startY; y <= endY; y++) {
				var pos = (x * width) + y;
				if (grid[pos] === obj) {
					grid[pos] = null;
				}
			}
		}
	};

	var Agent = function(color, x, y) {
		this.color = color;
		this.x = x;
		this.y = y;
		this.age = 0;
		this.lastBreed = 0;
		this.lastMove = 0;
		this.dead = false;

		if (!grid[(x * width) + y]) {
			addGrid(this);
			agents.push(this);
		}
	};

	Agent.prototype = {
		width: 1,
		height: 1,

		isChild: function() {
			return this.age < CHILD_AGE;
		},

		isDead: function() {
			return this.dead || DEATH_AGE > 0 && this.age > DEATH_AGE;
		},

		isInfertile: function() {
			return LAST_BREED > 0 && this.lastBreed > LAST_BREED;
		},

		isStagnant: function() {
			return LAST_MOVE > 0 && this.lastMove > LAST_MOVE;
		},

		kill: function() {
			this.dead = true;

			// Remove agent from the list
			var pos = agents.indexOf(this);
			if (pos >= 0) {
				agents.splice(pos, 1);
			}
		},

		move: function() {
			var dir = null;
			var colorAttractors = attractors[this.color];

			if (!colorAttractors.length || this.attractDelay > 0) {
				dir = directions[Math.floor(seededRandom() * directions.length)];
			} else if (this.weightCache) {
				dir = this.getDirOnWeight(this.weightCache);
			} else {
				dir = this.attract(colorAttractors);
			}

			var x = this.x + dir.x;
			var y = this.y + dir.y;

			if (x < 0) {
				x += width;
			} else if (x > width) {
				x -= width;
			}

			if (y < 0) {
				y += height;
			} else if (y > height) {
				y -= height;
			}

			var newPos = (x * width) + y;
			var other = grid[newPos];

			if (!other) {
				grid[(this.x * width) + this.y] = null;
				this.x = x;
				this.y = y;
				grid[newPos] = this;
				this.lastMove = 0;
				this.attractDelay -= 1;
				this.weightCache = null;

			} else {
				// Handle Collision
				if (other.color === this.color && other instanceof Agent &&
						!this.isChild() && !other.isChild() && !other.isDead()) {
					// Breed!
					if (seededRandom() < BREED) {
						this.breed();
					}
				}
				this.lastMove += 1;
			}

			if (this.age % 10 === 0 &&
					(this.isDead() || this.isInfertile() || this.isStagnant())) {
				this.kill();
			}
		},

		attract: function(colorAttractors) {
			var weights = [1, 1, 1, 1, 1, 1, 1, 1];
			var agent = this;
			var nearest = width;
			var match = false;

			for (var i = 0, l = colorAttractors.length; i < l; i++) {
				var attractor = colorAttractors[i];
				if (attractor.color === agent.color) {
					var dist_agent = dist(agent.x, agent.y, attractor.x, attractor.y);
					if (dist_agent < ATTRACTOR_RADIUS) {
						var diffX = attractor.x - agent.x;
						var diffY = attractor.y - agent.y;
						var weight = ATTRACTOR_RADIUS * (1 / attractor.strength) *
							attractor.weight();
						var xWeight = (ATTRACTOR_RADIUS - diffX) / weight;
						var yWeight = (ATTRACTOR_RADIUS - diffY) / weight;

						if (diffX > 0) {
							weights[2] += xWeight;
							weights[4] += xWeight;
							weights[7] += xWeight;
						} else if (diffX < 0) {
							weights[0] += xWeight;
							weights[3] += xWeight;
							weights[5] += xWeight;
						}

						if (diffY > 0) {
							weights[5] += yWeight;
							weights[6] += yWeight;
							weights[7] += yWeight;
						} else if (diffY < 0) {
							weights[0] += yWeight;
							weights[1] += yWeight;
							weights[2] += yWeight;
						}

						match = true;
					} else {
						nearest = Math.min(nearest, dist_agent);
					}
				}
			}

			if (!match) {
				this.attractDelay = nearest - (ATTRACTOR_RADIUS / 2);
				return directions[Math.floor(seededRandom() * directions.length)];
			}

			this.weightCache = weights;

			return this.getDirOnWeight(weights);
		},

		getDirOnWeight: function(weights) {
			var totalWeight = 0;

			for (var i = 0, l = weights.length; i < l; i++) {
				totalWeight += weights[i];
			}

			var cutoff = seededRandom() * totalWeight;
			var sumWeight = 0;
			var dir = -1;

			for (var i = 0, l = weights.length; i < l; i++) {
				sumWeight += weights[i];

				if (cutoff < sumWeight) {
					dir = i;
					break;
				}
			}
			if (dir == -1) {
				dir = floor(seededRandom(8));
			}


			return directions[dir];
		},

		collision: function(other) {
			if (other.color === this.color && other instanceof Agent &&
					!this.isChild() && !other.isChild()) {
				// Breed!
				if (seededRandom() < BREED) {
					this.breed();
				}
			}
		},

		breed: function() {
			this.lastBreed = 0;
			var dir = directions[Math.floor(seededRandom() * directions.length)];
			var childX = this.x + (dir.x * this.width);
			var childY = this.y + (dir.y * this.height);
			new Agent(this.color, childX, childY);
		},

		draw: function() {
			if (this.isChild()) {
				set(this.x, this.y, this.color);
			} else if (this.dead) {
				deadPixels.set(this.x, this.y, this.color);
			} else {
				set(this.x, this.y, this.color);
			}

			this.age += 1;
			this.lastBreed += 1;
		}
	};

	var Attractor = function(color, x, y, strength) {
		this.color = color;
		this.x = x;
		this.y = y;
		this.strength = strength;
		this.age = 0;

		addGrid(this, true);
		attractors[color].push(this);
	};

	Attractor.prototype = {
		lastFrame: -1,
		_weight: 1,
		width: 4,
		height: 4,

		isDead: function() {
			return ATTRACTOR_DEATH_AGE > 0 && this.age > ATTRACTOR_DEATH_AGE;
		},

		kill: function() {
			removeGrid(this);

			// Remove agent from the list
			var pos = attractors[this.color].indexOf(this);
			attractors[this.color].splice(pos, 1);
		},

		weight: function() {
			if (this.lastFrame < frameCount) {
				this._weight = ATTRACTOR_DEATH_AGE <= 0 ?
								1 :
								((ATTRACTOR_DEATH_AGE - this.age) / ATTRACTOR_DEATH_AGE);
				this.lastFrame = frameCount;
			}
			return this._weight;
		},

		draw: function() {
			if (this.isDead()) {
				this.kill();
				return;
			}
			var radius = ATTRACTOR_RADIUS * 2;
			if (this == newestAttractor) {
				if (attractorCooldown > MAX_ATTRACTOR_COOLDOWN * .5) {
					return;
				} else {
					var scale = 1 - (attractorCooldown/(MAX_ATTRACTOR_COOLDOWN * .5));
					radius *= scale;

				}
			}
			this.age += 1;
			noStroke();
			fill(this.color, 10 * this.weight());
			ellipse(this.x, this.y, radius, radius);
			fill(this.color, 255);
			rect(this.x - 3, this.y - 1, 6, 2);
			if (this.strength == ATTRACT) {
				rect(this.x - 1, this.y - 3, 2, 6);
			}
		},
	};

	size(d, d);

	loadPixels();

	var deadPixels = createGraphics(width, height);
	deadPixels.loadPixels();

	var loadedImage = loadImage(gameState.image);

	attractors[COLOR_A] = [];
	attractors[COLOR_B] = [];
	attractorGrids[COLOR_A] = [];
	attractorGrids[COLOR_B] = [];

	initAgents = function() {
		for (var i = 0; i < d; i++) {
			for (var j = 0; j < d; j++) {
				if (seededRandom() < INITIAL_AGENTS) {
					if (seededRandom() > .5) {
						new Agent(COLOR_A, i, j);
					} else {
						new Agent(COLOR_B, i, j);
					}

				}
			}
		}
	}

	initAgents();

	var PIXEL_CHECK = d * d; //10000;

	var curPos = 0;
	var score = 0;
	var scores = {};

	window.compareImage = function(callback) {
		if (!imageData || !imageData.getPixel) {
			loadedImage.loadPixels();
			imageData = loadedImage.pixels;
		}

		var numPixels = d * d;
		var max = Math.min(curPos + PIXEL_CHECK, numPixels);
		var curScore = 0;

		for (var k = curPos; k < max; k++) {
			var srcPixel = imageData.getPixel(k);
			var hit = grid[k];
			if (hit) {
				if (red(srcPixel) == red(hit.color)) {
					curScore += 1;
				}
			}
		}

		scores[curPos] = (curScore / PIXEL_CHECK);

		curPos += PIXEL_CHECK;

		if (k >= numPixels) {
			curPos = 0;
		}

		var sum = 0;
		var totalScores = 0;

		for (var s in scores) {
			sum += scores[s];
			totalScores += 1;
		}

		callback(100 * (sum / totalScores));
	};

	var gameOver = function() {
		if (gameTimer) {
			clearTimeout(gameTimer);
			gameTimer = null;
		}

		sketch.noLoop();

		$("#game").hide();
		$("#gameover").show();
		$("div.overwait").show();
		$("div.scores").hide();

		// Send in scores on done event
		// Calculate score on game over
		compareImage(function(score) {
			if (socket) {
				socket.emit("done", {
					image: gameState.image,
					score: score
				});

			} else {
				// Show scores for a single-player game
				showScores({
					scores: [
						{
							image: gameState.image,
							score: score
						}
					]
				});
			}
		});
	};

	var showScores = function(data) {
		$("div.overwait").hide();
		$("div.scores").show();

		$("#gameover").hide();
		$("#join").show();

		var scores = data.scores;
		var lines = [];

		// TODO: Show Scores
		for (var i = 0, l = scores.length; i < l; i++) {
			lines.push("<tr><td><img src='" + scores[i].image +
				"'/></td><th>" + scores[i].score.toFixed(1) +
				"%</th></tr>");
		}

		$("#score-table").html(lines.join(""));
	};

	drawCursor = function() {
		noStroke();
		if (ATTRACTOR_COLOR == 0) {
			fill(COLOR_B);
		} else {
			fill(COLOR_A);
		}

		var cursorScale = 1;
		if (attractorCooldown > 0) {
			var diffFromMiddle = Math.abs(attractorCooldown - MAX_ATTRACTOR_COOLDOWN * .5);
			cursorScale = diffFromMiddle/(MAX_ATTRACTOR_COOLDOWN * .5);
		}
		rectMode(CENTER);

		var mx = floor(mouseX * scaleFactor);
		var my = floor(mouseY * scaleFactor);

		var longSide = Math.round(20 * cursorScale);
		var shortSide = Math.round(6 * cursorScale);

		rect(mx, my, longSide, shortSide);
		if (ATTRACTOR_MODE == ATTRACT) {
			rect(mx, my, shortSide, longSide);
		}
		rectMode(CORNER);
	};

	var step = 0;

	var curAgentPos = 0;
	var agentStep = 2000;

	draw = function() {
		fill(0, 0, 0, 18);
		rect(0, 0, width, height);

		step += 1;

		if (DRAW_ATTRACTORS) {
			for (var color in attractors) {
				var items = attractors[color];
				for (var i = 0, l = items.length; i < l; i++) {
					if (items[i]) {
						items[i].draw();
					}
				}
			}
		}

		for (var i = curAgentPos,
				l = Math.min(agents.length, i + agentStep); i < l; i++) {
			var agent = agents[i];
			if (agent) {
				agent.move();
				//if (agent.dead) {
					agent.draw();
				//}
			}
		}

		curAgentPos += agentStep;

		if (curAgentPos >= agents.length) {
			curAgentPos = 0;
		}

		if (agents.length) {
			try {
				updatePixels();
			} catch(e) {}
		} else {
			gameOver();
		}

		deadPixels.updatePixels();
		image(deadPixels, 0, 0);
		drawCursor();
		checkPips();
		if (attractorCooldown > 0) {
			attractorCooldown--;
		}
	};

	var addAttractor = function(data) {
		newestAttractor = new Attractor(data.color,
			floor(data.x * scaleFactor),
			floor(data.y * scaleFactor), data.mode);
	};

	mousePressed = function() {
		if (attractorCooldown <= 0) {
			var data = {
				x: mouseX,
				y: mouseY,
				color: ATTRACTOR_COLOR > 0 ? COLOR_A : COLOR_B,
				mode: ATTRACTOR_MODE
			};

			addAttractor(data);
			attractorCooldown = MAX_ATTRACTOR_COOLDOWN;

			if (socket) {
				// Emit state when attractors are placed
				socket.emit("state", { attractor: data });
			}
		}
	};

	keyPressed = function() {
		switch(keyCode) {
			case 49:
				switchAttractorMode(ATTRACT, 0);
				break;
			case 50:
				switchAttractorMode(REPEL, 0);
				break;
			case 51:
				switchAttractorMode(ATTRACT, 1);
				break;
			case 52:
				switchAttractorMode(REPEL, 1);
				break;
			default:
				break;
				//pass
		}
	}

	if (socket) {
		// Run things on state
		socket.on('state', function(data) {
			if (data.attractor) {
				addAttractor(data.attractor);
			}
		});

		socket.on('scores', showScores);
	}

	if (gameState.duration) {
		gameDuration = gameState.duration;
		// Send in score after timer duration end.
		gameTimer = setTimeout(function() {
			gameOver();
		}, gameState.duration);
	}

	// Have agents die of stagnant at random times
	// TODO: High Score Board

	sketch.loop();
}
};