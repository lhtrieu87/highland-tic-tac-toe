var __ = require('highland');

var fs = require('fs');
var uuid = require('node-uuid');

var http = require('http');
var server = http.createServer();

var PORT = 3000;
server.listen(PORT, function () {
  console.log("Server listening on: http://localhost:%s", PORT);
});


