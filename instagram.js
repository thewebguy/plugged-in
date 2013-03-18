var request = require('request');
var mongodb = require('mongodb');


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


mongodb.connect(mongourl, function(err, conn){
	if (err) throw err;
	
  conn.collection('tweets', function(err, coll){ tweets = coll; });
  conn.collection('users', function(err, coll){ users = coll; });
	conn.collection('images', function(err, coll){ images = coll; });


	/*    Set up Instagram pull
	*/
	var instagram_timeout;
	var min_tag_id = 0;
	
	var pull_instagram = function(){
		instagram_timeout = setTimeout(function(){
			var url = 'https://api.instagram.com/v1/tags/pluggedinpll/media/recent'
				+ '?client_id=193accc062384ff599748651192f236e'
				+ '&client_secret=ec4d2e4379a0428fb70d9d1e7929aacc'
				+ '&min_tag_id=' + min_tag_id;
			
			request(url, function (error, response, body) {
			  if (!error && response.statusCode == 200) {
					body = JSON.parse(body);
					
					min_tag_id = body.pagination.next_min_tag_id;
					
					for (var i in body.data) {
						var post = body.data[i];
						
						// console.log('isnta', post);
					
					  var object_to_insert = {
							'username': post.user.username,
							'name': post.user.full_name,
							'image': post.images.standard_resolution.url,
							'user_id': post.user.id,
							'text': post.caption ? post.caption.text : '',
							'type': 'instagram',
							'social_id': post.id,
							'timestamp': post.created_time,
							'location': post.location
						};
						
						(function(){
							if (post.link){
								var image_to_insert = {url: post.link, image_url: post.images.standard_resolution.url, domain: 'instagram.com', user: post.user.username, timestamp: new Date()};
								
								images.find({url: image_to_insert.url}, {safe:true}, function(err, cursor){
							    cursor.toArray(function(err, items){
										console.log('Found: ', items);
										
										if (!items.length) {
											images.insert(image_to_insert, {safe:true}, function(err, docs){
												console.log('Inserted!', err, docs);
											});
										}
									});
								})
							}
						})();
					}
					
			  } else {
			  	console.log(response.statusCode, body, error);
			  }
			});
			
			pull_instagram();
		}, 120000);
	}
	
	pull_instagram();
});