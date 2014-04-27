var express = require('express'),
    app 	  = express(),
    request = require('request'),
    htmlparser = require('htmlparser'),
    select = require('soupselect').select,
    uuid = require('node-uuid'),
    _ = require('underscore');

function shuffle(o){
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
}

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Keep an array of guesses
var guessesDb = [];

// Convenience for allowing CORS on routes - GET and POST
app.use(function(req, res, next) {
  var oneof;
  oneof = false;
  if (req.headers.origin) {
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    oneof = true;
  }
  if (req.headers["access-control-request-method"]) {
    res.header("Access-Control-Allow-Methods", req.headers["access-control-request-method"]);
    oneof = true;
  }
  if (req.headers["access-control-request-headers"]) {
    res.header("Access-Control-Allow-Headers", req.headers["access-control-request-headers"]);
    oneof = true;
  }
  if (oneof) {
    res.header("Access-Control-Max-Age", 60 * 60 * 24 * 365);
  }
  if (oneof && req.method === "OPTIONS") {
    return res.send(200);
  } else {
    return next();
  }
});

// Serve index.html as static text
app.use(express.static(__dirname + '/public'));

app.use(express.urlencoded());

function createResponse(newGuesses) {
  var refreshSince = new Date();
  if (newGuesses.length > 0) {
    refreshSince = newGuesses[newGuesses.length-1].timestamp;
  }
  return {
    guesses: newGuesses,
    refreshSince: refreshSince
  };
}

//githubauth(app);

app.get('/guesses/:since?', function(req, res) {
  if (!req.params.since) {
    res.json(createResponse(guessesDb));
  } else {
    var since = new Date(req.params.since);
    var recentGuesses = [];
    console.log('asking since:');
    console.log(since);
    console.log('actual most recent:');
    if (guessesDb.length > 0) {
      console.log(guessesDb[guessesDb.length-1].timestamp);
    }
    guessesDb.forEach(function(guesses) {
      if (guesses.timestamp > since) {
        recentGuesses.push(guesses);
      }
    });
    res.json(createResponse(recentGuesses));
  }
});

app.post('/guesses', function(req, res) {
  var guesses = req.body;
  console.log (guesses);
  guesses.timestamp = new Date();
  guessesDb.push(guesses);
  res.send("OK");
});

app.get('/stats', function(req, res) {
  var guessCounts = _
    .chain(guessesDb)
    .pluck('guesses')
    .map(function(guesses) { return guesses.length} )
    .value();
  res.send(guessCounts);
});

var handler = new htmlparser.DefaultHandler(function (error, dom) {
    if (error) {
      console.log("Error:");
      console.log(error);
    }
    else {
      console.log('Done:');
    }
});
var parser = new htmlparser.Parser(handler);

var games = {};

function gameAdd(game) {
  games[game.id] = game;
}

function gameCreate(name) {
  var id = uuid.v1();
  return {
    id: id,
    name: name,
    started: false,
    completed: false
  }
}

function gamesOpen() {
  return _.where(games, {completed:false});
}

function gameById(id) {
  return _.findWhere(games, {id:id});
}


app.get('/gamesOpen', function(req, res) {
  res.json(gamesOpen());
});

app.post('/game', function(req, res) {
  var name = req.body.name;
  var game = gameCreate(name);
  request.get('http://api.plnkr.co/tags/cdps,cdprofile?files=yes', 
    function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var plunks = [];
      body = JSON.parse(body);
      body.forEach(function(plunk) {
        if (plunk.fork_of == 'I26fUu') {
          plunks.push(plunk);
        }
      });
      plunks = shuffle(plunks);
      game.plunks = plunks;
    }
    gameAdd(game);
    res.json(game);
  });
});

app.get('/images/:id', function(req, res) {  
  var game = gameById(req.params.id);
  console.log(game);
  var plunk = game.plunks[0];
  var content = plunk.files["index.html"].content;
  var profileImages = [];
  parser.parseComplete(content);
  select(handler.dom, 'img').forEach(function(el) {
    profileImages.push(el.attribs.src);
  });
  res.json(profileImages);
});
    
app.get('/playersRemaining/:id', function(req, res) {
  var game = gameById(req.params.id);
  var players = _.pluck(game.plunks, 'user');
  players = _.map(players, function(item) {
    return item.login;
  });
  res.json(players);
});

app.post('/guess/:id', function(req, res) {
  console.log(req.params);
  var game = gameById(req.params.id);
  console.log("The game:");
  console.log(game);
  var guess = req.body.guess;
  var plunk = game.plunks[0];
  console.log('Plunk:');
  console.log(plunk);
  var currentUser = plunk.user.login;
  if (guess == currentUser) {
    // If won, advance it:
    game.plunks.shift();
    res.send("Correct!");    
  } else {
    res.send("Nope!");
  }
});

var port = process.env.PORT || 80;

app.listen(port, null, function (err) {
  console.log('Your chat server is listening at: http://localhost:' + port);
});