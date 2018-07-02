// Use the websocket-relay to serve a raw MPEG-TS over WebSockets. You can use
// ffmpeg to feed the relay. ffmpeg -> websocket-relay -> browser
// Example:
// node websocket-relay <settings file>
// ffmpeg -i <some input> -f mpegts http://localhost:8081

// Written by Dominic Szablewski for jsmpeg, modified for Robot Remote.

const log4js = require('log4js');
log4js.configure({
  appenders: {
    info_log: { type: 'file', filename: 'info.log' },
    err_log: { type: 'file', filename: 'err.log' }
  },
  categories: {
    info: { appenders: [ 'info' ], level: 'info' },
    err:  { appenders: ['err_log'], level: 'error'}
  }
});

const info_logger = log4js.getLogger('info');
const err_logger = log4js.getLogger('err');

var fs = require('fs'),
	http = require('http'),
	WebSocket = require('ws'),
	https = require('https');
//Q: why is this one with ` instead of ' ????
if(process.argv.length != 3){
	info_logger.info(`WEBSOCKET_RELAY: Usage: node websocket-relay <settings_file>`);
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
	info_logger.info(
		'WEBSOCKET_RELAY: New WebSocket Connection: ', 
		(upgradeReq || socket.upgradeReq).socket.remoteAddress,
		(upgradeReq || socket.upgradeReq).headers['user-agent'],
		'('+socketServer.connectionCount+' total)'
	);
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
		info_logger.info('WEBSOCKET_RELAY: Attempting to set secret...')
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
			
			info_logger.info('WEBSOCKET_RELAY: Secret set.');
			
			res.writeHead(200);
			res.write('Successfully received and executed request.');
		}).catch((err) => {
			err_logger.error('WEBSOCKET_RELAY: Error: ' + err);
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
	info_logger.info('WEBSOCKET_RELAY: Connection attempted, trying to upgrade...');

	if(STREAM_SECRET == null ||  request.url.substring(1).split('/')[0] != encodeURIComponent(STREAM_SECRET)){
		err_logger.error('WEBSOCKET_RELAY: Invalid incoming secret, refuse to connect.');
		socket.destroy();
		return;
	}

	if(socketServer.connectionCount > 0){
		err_logger.error('WEBSOCKET_RELAY: More than one connection already!');
		socket.destory();
		return;
	}

	socketServer.connectionCount++;

	socket.on('close', function(code, message){
		socketServer.connectionCount--;
		info_logger.info(
			'WEBSOCKET_RELAY: Disconnected WebSocket ('+socketServer.connectionCount+' total)'
		);
	});

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
		err_logger.error(
			'WEBSOCKET_RELAY: Failed Stream Connection: '+ request.socket.remoteAddress + ':' +
			request.socket.remotePort + ' - not local.'
		);
		response.end();
	}

	response.connection.setTimeout(0);
	
	info_logger.info(
		'WEBSOCKET_RELAY: Stream Connected: ' + 
		request.socket.remoteAddress + ':' +
		request.socket.remotePort
	);
	
	request.on('data', function(data){
		socketServer.broadcast(data);
	});

	request.on('end',function(){
		info_logger.info('WEBSOCKET_RELAY: close');
	});

}).listen(STREAM_PORT);

info_logger.info('WEBSOCKET_RELAY: Listening for incomming MPEG-TS Stream on http://127.0.0.1:'+STREAM_PORT+'/');
info_logger.info('WEBSOCKET_RELAY: Awaiting WebSocket connections on ws://127.0.0.1:'+WEBSOCKET_PORT+'/<secret>');
