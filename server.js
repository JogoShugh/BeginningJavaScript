var express = require('express'),
    app 	  = express(),
    request = require('request'),
    _       = require('underscore');

// Keep an array of guesses
var guessesDb = [];

// Serve index.html as static text
app.use(express.static(__dirname + '/public'));

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


var port = process.env.PORT || 80;

app.listen(port, null, function (err) {
  console.log('Your chat server is listening at: http://localhost:' + port);
});