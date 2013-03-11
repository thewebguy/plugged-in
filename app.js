var express = require('express');

var app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

var Twit = require('twit');
var request = require('request');
var fs = require('fs');

var mongodb = require('mongodb');
// var exec = require('child_process').exec;



/*    Express Options
*/
app.configure(function(){
	app.use(express.static(process.env.PWD + '/p2'));
});



/*    Init Express
*/
server.listen(process.env.PORT || 3001);


// assuming io is the Socket.IO server object
io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});


io.sockets.on('connection', function (socket) {
  // socket.emit('news', { hello: 'world' });
  // socket.on('my other event', function (data) {
  //   console.log(data);
  // });
});



/*    Init MongoDB
*/
var generate_mongo_url = function(obj){
  obj.hostname = (obj.hostname || 'localhost');
  obj.port = (obj.port || 27017);
  obj.db = (obj.db || 'test');
  
  if(obj.username && obj.password){
    return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
  } else {
    return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
  }
}

// nodejitsu
// process.env.MONGOLAB_URI = 'mongodb://nodejitsu_thewebguy:r92t4geg8jldk5jrapn9i2rp09@ds043927.mongolab.com:43927/nodejitsu_thewebguy_nodejitsudb434421380';

if (process.env.MONGOLAB_URI) {
	var mongourl = process.env.MONGOLAB_URI;
} else if(process.env.VCAP_SERVICES){
	var env = JSON.parse(process.env.VCAP_SERVICES);
	var mongo = env['mongodb-1.8'][0]['credentials'];
} else {
  var mongo = {
    "hostname":"localhost",
    "port":27017,
    "username":"",
    "password":"",
    "name":"",
    "db":"image-loader"
  }
	
	var mongourl = generate_mongo_url(mongo);
	var mongourl = "mongodb://heroku:df18799708dbe682a0644ef3ec227fb9@miles.mongohq.com:10033/app10327622";
}



/*    Init Twitter
*/
var opts = {
    consumer_key:         '9DlTFe3I6rLhVi0EjAgVbQ'
  , consumer_secret:      'qPtJ7i6hmZBUDkqNv8ASl5Axt4MhU0zjvvBmbuQhE'
  , access_token:         '17104817-wL2r9D9Kmzpt0cVGfRnWN9ZdiN8NPWWSNd8303yQL'
  , access_token_secret:  '7K5q5W7Tk8DF6hPxefqRjyaqDGr2MEGJL58yvPWCjk'
};

var T = new Twit(opts);

var tweets,
		users,
		images;

var url_regex = /^https?\:\/\/((pic\.twitter|twitpic|)\.com|(instagr\.am|instagram\.com)\/p)\/(.*)/ig;



/*    Connect MongoDB and get rolling
*/
mongodb.connect(mongourl, function(err, conn){
	if (err) throw err;
	
  conn.collection('tweets', function(err, coll){ tweets = coll; });
  conn.collection('users', function(err, coll){ users = coll; });
	conn.collection('images', function(err, coll){ images = coll; });
	
	var photos_in_path = 'assets/raw-images/';
	var photos_out_path = 'assets/processed-images/';
	var x_path = 'assets/x.png';

	// var stream = T.stream('statuses/filter', {track: 'twitpic,instagr,pic'});
	var stream = T.stream('statuses/filter', {track: 'pluggedinplaylistg'});
		
	stream.on('tweet', function (tweet) {
		save_tweet(tweet);
	});



	function save_tweet(tweet) {
		return false;
		
	  var object_to_insert = {
			'username': tweet.user.screen_name,
			'name': tweet.user.name,
			'image': tweet.user.profile_image_url,
			'user_id': tweet.user.id,
			'type': 'tweet',
			'social_id': tweet.id,
			'timestamp': tweet.created_at,
			'text': tweet.text,
			'source': tweet.source,
			'location': tweet.user.location,
			'geo': tweet.geo,
			'coordinates': tweet.coordinates,
			'place': tweet.place
		};
		var urls = tweet.entities.urls;
		
		for (var u in urls) {
			var url = urls[u];
			var matches = url.expanded_url.match(url_regex);
			
			if (matches) {
				var match = matches[0];
				var domain = match.match(/https?\:\/\/[^\/]+/ig)[0].replace(/https?\:\/\//ig,'');
				
				images.find({url: match}, {safe:true}, function(err, cursor){
			    cursor.toArray(function(err, items){
						if (!items.length) {
							images.insert({url: match, domain: domain, user: tweet.user.screen_name, timestamp: new Date()}, {safe:true}, function(err, docs){
								console.log('Inserted ' + match);
								save_full_url(docs[0]);
							});
						} else {
							console.log('FOUND  ' + match);
						}
					});
				});
				
			}
		}
		
	  tweets.insert(object_to_insert, {safe:true}, function(err){});
	}



	function save_full_url(image, save_image) {
		var image_url = '';
		save_image = save_image || false;
		
		switch (image.domain.toLowerCase()) {
			case 'twitpic.com':
				image_url = image.url.replace('twitpic.com/','twitpic.com/show/thumb/');
				break;
									
			case 'instagram.com':
			case 'instagr.am':
				return;
				image_url = image.url.replace(/\/$/g,'') + '/media?size=' + (save_image ? 'l' : 't');
				break;
								
			default:
				return;
				break;
		}

		request({url:image_url, encoding: 'binary'}, function (error, response, body) {
		  if (!error && response.statusCode == 200) {
				
				if (save_image) {
					var ext = response.request.uri.href.split('.').pop();
					var filename = image._id + '.' + ext;
					
					console.log('filename: ', filename);
				
					fs.writeFile(photos_in_path + filename, body, 'binary', function(err){
						if (err) {
							console.log('error: ', err);
						} else {
							console.log('saved: ', filename);
						}
					});
				}
				
				images.update({url: image.url}, {$set: {image_url: response.request.uri.href}}, {safe: true, multi: true}, function(err){
			    console.log('Saved ' + response.request.uri.href);
				});
		  } else {
		  	console.log(response.statusCode, error);
		  }
		});
	}



	/*    Express Routes
	*/
	// app.get('/item/:id', function(req, res) {
	// 	var id = req.params.id;
	// 		
	//     tweets.findOne({_id: tweets.db.bson_serializer.ObjectID.createFromHexString(id)}, function(err, result) {
	//     	//result = [result];
	//     	console.log("Result: " + result);
	//     	
	//     res.writeHead(200, {'Content-Type': 'text/json', 'Access-Control-Allow-Origin': '*'});
	//     res.write(JSON.stringify(result));
	//     res.end();
	//     });
	//   });
		
	app.get('/images.json', function(req, res) {
		var id = req.params.id;
		var count = 20;
		
		var options = {status: "approve"}
		var last_id = req.query.last_id && req.query.last_id != 0 ? req.query.last_id : null;
		
		if (last_id) {
			options[id_field]  = {$gt: new Date(last_id)}
		}
		
    images.find(options, {limit: count, sort:[["approve_timestamp","asc"]]}, function(err, cursor) {
	    cursor.toArray(function(err, items){
		    res.writeHead(200, {'Content-Type': 'text/json', 'Access-Control-Allow-Origin': '*'});
		    res.write(JSON.stringify(items));
		    res.end();
	    });
    });
  });
		
	// app.get('/users', function(req, res) {
	//     users.find({}, {limit: 30, sort:[['name','asc']]}, function(err, cursor) {
	//     cursor.toArray(function(err, items){
	// 	    res.writeHead(200, {'Content-Type': 'text/json', 'Access-Control-Allow-Origin': '*'});
	// 	    res.write(JSON.stringify(items));
	// 	    res.end();
	//     });
	//     });
	//   });
		
	app.get('/images/:action', function(req, res) {
		if (!req.query.password || req.query.password != 'P2013') {
	    res.writeHead(200, {'Content-Type': 'text/json', 'Access-Control-Allow-Origin': '*'});
	    res.write(JSON.stringify({error: "password"}));
	    res.end();
			return;
		}
		
		var action = req.params.action;
		var favorite = 0;
		
		if (action == 'favorite') {
			action = 'approve';
			favorite = 1;
		}
		
		if (action == 'approve' || action == 'reject') {
			var url = req.query.url;
			var id = req.query.id;
			
			console.log('url: ', url);
			
			var set = {status: action, favorite: favorite};
			set[action + '_timestamp'] = new Date();
			
			images.update({url: url}, {$set: set}, {safe: true, multi: true}, function(err){
				io.sockets.emit('update', {status:action, id:id});
				
				if (action == 'approve') {
					images.findOne({_id: new mongodb.ObjectID(id)}, function(err, image){
						save_full_url(image, true);
					})
				}
				
		    res.writeHead(200, {'Content-Type': 'text/json', 'Access-Control-Allow-Origin': '*'});
		    res.write(JSON.stringify({success: true}));
		    res.end();
			});
			return;
		}
		
		
		var last_id = req.query.last_id && req.query.last_id != 0 ? req.query.last_id : null;
		
		var count = last_id ? 10 : 20; 
		var options = {};
		var id_field = 'timestamp';
		var direction = 'desc';
		var status = req.query.status;

		if (status == 'favorite') {
			status = 'approve';
			favorite = 1;
		}
		
		if (status && status != 'new') {
			options.status = status;
			id_field = options.status + '_timestamp';
			// direction = 'asc';
		}
		
		if (last_id) {
			options[id_field]  = {$gt: new Date(last_id)}
		}
		
		if (favorite) {
			options['favorite'] = favorite;
		}
		
		console.log({count: count, last_id: last_id, options: options, id_field: id_field, direction: direction});
		
    images.find(options, {limit: count, sort:[[id_field,direction]]}, function(err, cursor) {
	    cursor.toArray(function(err, items){
		    res.writeHead(200, {'Content-Type': 'text/json', 'Access-Control-Allow-Origin': '*'});
		    res.write(JSON.stringify(items));
		    res.end();
	    });
    });
  });



	/*    Listen for Downloaded Images
	*/
	if (0) {
		fs.watch(photos_in_path, function (event, filename) {
		  console.log('event is: ' + event);
	
			fs.readdir(photos_in_path, function(err, files){
				for (var i = 0; i < files.length; i++) {
					(function(){
						var file = files[i];
					
						if (file.match(/\.jpg$/gi)) {
							child = exec('convert  -colorspace Gray ' + photos_in_path + file + '  -page +0+0 ' + x_path + '  -flatten  ' + photos_out_path + file,
							  function (error, stdout, stderr) {      // one easy function to capture data/errors
									exec('rm ' + photos_in_path + file);
								
							    console.log('stdout ', file,  stdout);
								
							    if (error !== null) {
							      console.log('exec error: ' + error);
							    }
							});
						}
					})();
				}
			});
		});
	}


});




