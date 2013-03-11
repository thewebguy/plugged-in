// npm install mongodb
var mongodb = require('mongodb');
var url = require('url');
var log = console.log;

// process.env.MONGOHQ_URL = "mongodb://heroku:df18799708dbe682a0644ef3ec227fb9@miles.mongohq.com:10033/app10327622";
 
var connectionUri = url.parse(process.env.MONGOHQ_URL);
var dbName = connectionUri.pathname.replace(/^\//, '');
 
mongodb.Db.connect(process.env.MONGOLAB_URI, function(error, client) {
  if (error) throw error;
 
  client.collectionNames(function(error, names){
    if(error) throw error;
 
    // output all collection names
    log("Collections");
    log("===========");
    var lastCollection = null;
    names.forEach(function(colData){
      var colName = colData.name.replace(dbName + ".", '')
      log(colName);
      lastCollection = colName;
    });
 
    var collection = new mongodb.Collection(client, lastCollection);
    log("\nDocuments in " + lastCollection);
    var documents = collection.find({}, {limit:5});
 
    // output a count of all documents found
    documents.count(function(error, count){
      log("  " + count + " documents(s) found");
      log("====================");
 
      // output the first 5 documents
      documents.toArray(function(error, docs) {
        if(error) throw error;
 
        docs.forEach(function(doc){
          log(doc);
        });
      
        // close the connection
        client.close();
      });
    });
  });
});
