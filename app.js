var express = require('express')
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

server.listen(4521);

app.use(express.static(__dirname + '/'));

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

var images = ["mandrill.png", "mandrill.png"];
var gameDuration = 90 * 1000;
var curGame;

var createGame = function() {
	curGame = {
		//    When the game is created generate a seed
		seed: Math.random(),
		unusedImages: images.slice(0),
		duration: gameDuration,
		scores: [],
		players: []
	};
};

var addPlayer = function(game, socket) {
	//    Give them an image to work off of
	//    Make sure that the image isn't the same as another player's
	var image;
	var imagePos = game.unusedImages[
		Math.floor(game.seed * game.unusedImages.length)];

	// No slots left!
	if (imagePos < 0) {
		return false;
	} else {
		image = game.unusedImages.splice(imagePos, 1)[0];
	}

	game.players.push({
		image: image,
		socket: socket
	});

	return image;
};

var gameDone = function(socket) {
	// When all clients are done, a final score is sent and shown
	socket.emit('scores', { scores: game.scores })
	socket.broadcast.emit('scores', { scores: game.scores });

	// When all are done, shut down game and close connections
	curGame = null;
};

var gameStateLog = function() {
	if (!curGame) {
		return;
	}

	console.log("# Players: " + curGame.players.length);
};

io.sockets.on('connection', function (socket) {
	// If no one is connected to a game, start a game
	if (!curGame) {
		createGame();
	}

	// If a game exists, connect people to that game
	// Only connect if there are available slots
	var image = addPlayer(curGame, socket);
	if (image) {
		//    Send them the seed and how long the game will last
		socket.emit('gameConnect', {
			seed: curGame.seed,
			duration: curGame.duration,
			image: image
		});

		console.log("Player connected: " + image);
		gameStateLog();

	} else {
		socket.emit('error', {
			msg: "Game full. Try again later!"
		});
	}

	// Re-broadcast game state to other players
	socket.on('state', function(data) {
		socket.broadcast.emit('state', data);
	});

	// Give client a button to start a new game
	socket.on('done', function (data) {
		//    Client sends in their final score
		curGame.scores.push(data);

		// When all scores come in the game is over
		if (curGame.scores.length === curGame.players.length) {
			gameDone(socket);
		}
	});

	// TODO: Handle disconnect, remove player from game!
	socket.on('disconnect', function(data) {
		if (!curGame) {
			return;
		}
		curGame.players = curGame.players.filter(function(player) {
			if (player.socket === socket) {
				curGame.unusedImages.push(player.image);
				return false;
			}
			return true;
		});

		console.log("Player disconnected.");
		gameStateLog();
	});
});