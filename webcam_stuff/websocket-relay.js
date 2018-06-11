// Use the websocket-relay to serve a raw MPEG-TS over WebSockets. You can use
// ffmpeg to feed the relay. ffmpeg -> websocket-relay -> browser
// Example:
// node websocket-relay yoursecret 8081 8082
// ffmpeg -i <some input> -f mpegts http://localhost:8081/yoursecret

// Written by Dominic Szablewski for jsmpeg, modified for Robot Remote.


var fs = require('fs'),
	http = require('http'),
	WebSocket = require('ws'),
	https = require('https');

if(process.argv.length != 3){
	console.log(`Usage: node websocket-relay <settings_file>`);
	process.exit(1);
}

if(!process.argv[2].startsWith('/')) process.argv[2] = './' + process.argv[2];

var options = require(process.argv[2]);

var STREAM_SECRET = null,
	STREAM_PORT = options['stream_port'],
	WEBSOCKET_PORT = options['websock_port'];

var SECRET_TIMEOUT = null;


// Websocket Server
var socketServer = new WebSocket.Server({
	perMessageDeflate: false,
	clientTracking: true,
	noServer: true
});

socketServer.connectionCount = 0;
socketServer.on('connection', function(socket, upgradeReq) {
	socketServer.connectionCount++;

	if(socketServer.connectionCount > 1){
		socket.close(1000, 'Someone else is already connected!');
		return;
	}
	
	console.log(
		'New WebSocket Connection: ', 
		(upgradeReq || socket.upgradeReq).socket.remoteAddress,
		(upgradeReq || socket.upgradeReq).headers['user-agent'],
		'('+socketServer.connectionCount+' total)'
	);
	
	socket.on('close', function(code, message){
		socketServer.connectionCount--;
		console.log(
			'Disconnected WebSocket ('+socketServer.connectionCount+' total)'
		);
	});
});

socketServer.broadcast = function(data) {
	socketServer.clients.forEach(function each(client) {
		if (client.readyState === WebSocket.OPEN) {
			client.send(data);
		}
	});
};

function read_all_data(readable, encoding, byte_cap){
	let data = '';
	return new Promise((resolve, reject)=>{
		readable.on('data', (chunk) =>{
			data += chunk.toString(encoding);
			if(byte_cap !== undefined){
				if(byte_cap <= data.length){
					readable.destroy({
						err_msg: "Past byte cap!", 
						partial_message: data
					});
				}
			}
		});

		readable.on('end', ()=>{
			resolve(data);
		});

		readable.on('error', err => reject(err));
	});
};

function webserver_comm(req, res){
	if(req.url === '/' && req.method === 'POST'){
		console.log('Attempting to set secret...')
		read_all_data(req, 'utf8')
		.then((data) => {
			let json = JSON.parse(data);

			if(json.secret === undefined || json.expires_in === undefined){
				throw "bad request";
			}

			if(SECRET_TIMEOUT != null){
				clearTimeout(SECRET_TIMEOUT);
				SECRET_TIMEOUT = null;
				socketServer.clients.forEach(function(client) {
					if (client.readyState === WebSocket.OPEN) {
						client.close(1001, "New secret negotiated.");
					}
				});
			}

			STREAM_SECRET = json.secret;
			SECRET_TIMEOUT = setTimeout(() => { 
				STREAM_SECRET = null;
				SECRET_TIMEOUT = null;
				socketServer.clients.forEach(function(client) {
					if (client.readyState === WebSocket.OPEN) {
						client.close(1001, "Timeslot is over.");
					}
				});
			}, json.expires_in);
			
			console.log('Secret set.');
			
			res.writeHead(200);
			res.write('Successfully received and executed request.');
		}).catch((err) => {
			console.log('Error: ' + err);
			res.writeHead(500);
			res.write('Error occured while processing your request.');
		}).finally(()=>{
			res.end();
		});
		
	}else if(req.url === '/' && req.method === 'GET'){
		res.writeHead(200);
		res.end(JSON.stringify({connected: socketServer.connectionCount > 0, cur_secret: STREAM_SECRET}));
	}else{
		res.writeHead(404);
		res.end('Invalid method or path.');
	}
}

//HTTPS Server to get commands from webserver
let https_options = {
	key: fs.readFileSync(options['key'], 'utf8'),
	cert: fs.readFileSync(options['cert'], 'utf8'),
	ca: fs.readFileSync(options['client_ca'], 'utf8'),
	requestCert: true
}

if(options['ssl']){
	var commServer = https.createServer(https_options, webserver_comm).listen(options["webserver_listen_port"]);
	https_options.requestCert = false;
	var wsServer = https.createServer(https_options);
}else{
	var commServer = http.createServer(webserver_comm).listen(options["webserver_listen_port"]);
	https_options.requestCert = false;
	var wsServer = https.createServer(https_options);
}

wsServer.on('upgrade', function(request, socket, head){
	console.log('Connection attempted, trying to upgrade...');

	if(STREAM_SECRET == null ||  request.url.substring(1).split('/')[0] != encodeURIComponent(STREAM_SECRET)){
		console.log('Invalid incoming secret, refuse to connect.');
		socket.destroy();
		return;
	}

	socketServer.handleUpgrade(request, socket, head, (ws)=>{
		socketServer.emit('connection', ws, request);
	});

});

wsServer.listen(WEBSOCKET_PORT);

// HTTP Server to accept incomming MPEG-TS Stream from ffmpeg
var streamServer = http.createServer( function(request, response) {
	var params = request.url.substr(1).split('/');
	//Only allow local connections.
	if (request.socket.remoteAddress !== '127.0.0.1' && request.socket.remoteAddress !== '::1') {
		console.log(
			'Failed Stream Connection: '+ request.socket.remoteAddress + ':' +
			request.socket.remotePort + ' - not local.'
		);
		response.end();
	}

	response.connection.setTimeout(0);
	
	console.log(
		'Stream Connected: ' + 
		request.socket.remoteAddress + ':' +
		request.socket.remotePort
	);
	
	request.on('data', function(data){
		socketServer.broadcast(data);
	});

	request.on('end',function(){
		console.log('close');
	});

}).listen(STREAM_PORT);

console.log('Listening for incomming MPEG-TS Stream on http://127.0.0.1:'+STREAM_PORT+'/');
console.log('Awaiting WebSocket connections on ws://127.0.0.1:'+WEBSOCKET_PORT+'/<secret>');
