var express = require('express'),
    app 	  = express(),
    request = require('request'),
    htmlparser = require('htmlparser'),
    select = require('soupselect').select,
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

app.get('/profiles', function(req, res) {
  var profileImages = [];
  var completedRequests = 0;
  request.get('http://api.plnkr.co/tags/cdps,cdprofile?files=yes', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      body = JSON.parse(body);
      body.forEach(function(plunk) {
        if (plunk.fork_of == 'I26fUu') {
          var content = plunk.files["index.html"].content;
          parser.parseComplete(content);
          select(handler.dom, 'img').forEach(function(el) {
            profileImages.push(el.attribs.src);
          });
        }
      });
    }
    res.json(profileImages);
  });
});
// I26fUu
app.get('/players', function(req, res) {
  request.get('http://api.plnkr.co/tags/cdps,cdprofile', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      body = JSON.parse(body);
      console.log(body);
      res.json("OK");
      /*
      var profiles = _.map(body, function(item) {
        return item.url;
      });
      */
    }
  });
});

var allPlunks = [];
var currentPlunk = '';

app.get('/resetGame', function(req, res) {
  request.get('http://api.plnkr.co/tags/cdps,cdprofile?files=yes', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      allPlunks.length = 0;
      body = JSON.parse(body);
      body.forEach(function(plunk) {
        if (plunk.fork_of == 'I26fUu') {
          allPlunks.push(plunk);
        }
      });
      allPlunks = shuffle(allPlunks);
      console.log('Total items:');
      console.log(allPlunks.length);
    }
    res.json(currentPlunk);
  });
});

app.get('/profileCurrent', function(req, res) {
  var plunk = allPlunks[0];
  var content = plunk.files["index.html"].content;
  var profileImages = [];
  parser.parseComplete(content);
  select(handler.dom, 'img').forEach(function(el) {
    profileImages.push(el.attribs.src);
  });
  res.send(profileImages);
});
    
app.get('/playersRemaining', function(req, res) {
  var players = _.pluck(allPlunks, 'user');
  players = _.map(players, function(item) {
    return item.login;
  });
  res.json(players);
});

app.post('/guess', function(req, res) {
  var guess = req.body.guess;
  console.log(guess);
  var currentUser = allPlunks[0].user.login;
  if (guess == currentUser) {
    allPlunks.shift();
    res.send("Correct!");    
  } else {
    res.send("Nope!");
  }
});

var port = process.env.PORT || 80;

app.listen(port, null, function (err) {
  console.log('Your chat server is listening at: http://localhost:' + port);
});