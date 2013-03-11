var request = require('request');
var exec = require('child_process').exec;


var images_timeout,
		base_url = 'http://insta-loader.herokuapp.com/images.json',
		delay = 300,
		last_id = 0;

var pull_images = function(){
	console.log('Setting pull.');
	
	images_timeout = setTimeout(function(){
		var url = base_url + '?last_id=' + last_id;
		console.log('Starting pull: ', url);
		
		request(url, function(error, response, body){
			console.log(error, response, body);
			
		  if (!error && response.statusCode == 200) {
				var images = JSON.parse(body);
				
				for (var i in images) {
					var image = images[i];
					var filename = images.split('/').pop();
					
					console.log('wget ' + image, function (error, stdout, stderr) {      // one easy function to capture data/errors
						console.log('move ' + filename);
					});
				}
			}
		});
		
		// pull_images();
	}, delay);
}();

