const https = require('https');
const WebSocket = require('ws');
const fs = require('fs');
const PLCConnection = require('./modbus').PLCConnection;
const log4js_template = require('../common/log4jstemplate');

if(process.argv.length < 3 || process.argv.length > 4){
    info_logger.info('Usage: node server.js <options_file> [<signal pid>]');
    process.exit(1);
}

class HTTPError extends Error {
    constructor(msg, err_code){
        super(msg);
        this.err_code = err_code;
    }
}

function get_file_relative_dirname(str){
    if(str.startsWith('/')){
        return str;
    }
    return __dirname + '/' + str;
}

let options = require(process.argv[2].startsWith('/') ? process.argv[2] : './' + process.argv[2]);

const log4js = require('log4js');
let appenders = {
	info_log: { type: 'file', filename: 'info.log', layout: log4js_template},
	err_log: { type: 'file', filename: 'err.log', layout: log4js_template}
}

if(options.multiprocess_logging){
	appenders.multiprocess = { type: 'multiprocess', mode: 'worker', loggerPort: options.multiprocess_logging_port},
	appenders.multiprocess_layout = {type: '../common/layout_appender', appender: 'multiprocess', layout: log4js_template}
}

log4js.configure({
    appenders: appenders,
    categories: {
        default: {appenders: [ options.multiprocess_logging ? 'multiprocess_layout' : 'info_log' ], level: options.log_level}
    }
});

const info_logger = log4js.getLogger();
const err_logger = log4js.getLogger();

let server_key = fs.readFileSync(get_file_relative_dirname(options['key_file']));
let server_cert = fs.readFileSync(get_file_relative_dirname(options['cert_file']));
let cacert = fs.readFileSync(get_file_relative_dirname(options['client_ca_file']));

let https_options = {
    cert: server_cert,
    key: server_key,
    ca: cacert,
    requestCert: true,
    rejectUnauthorized: true
};

let secret = null;
let secret_timer = null;

//Initial socket server stuff
let socketServer = new WebSocket.Server({
    perMessageDeflate: false,
    clientTracking: true,
    noServer: true
});

//startup modbus

let plc = new PLCConnection(options['modbus_host'], options['modbus_port'], options['modbus_slave_num'],
        options['pin_assignments'], options['modbus_timeout'], options['modbus_sleep_interval'], info_logger);

//functions to make sure ws is alive.
function heartbeat(){
    this.isAlive = true;
}

function noop(){}

socketServer.connectionCount = 0;
socketServer.on('connection', function(socket, upgradeReq){
    socket.isAlive = true;

    info_logger.info(
		'New WebSocket Connection: ', 
		(upgradeReq || socket.upgradeReq).socket.remoteAddress,
		(upgradeReq || socket.upgradeReq).headers['user-agent'],
		'('+socketServer.connectionCount+' total)'
	);

    socket.on('pong', heartbeat);

    socket.on('message', function(message){
        info_logger.info('Received message: ' + message);
        plc.setPressed(JSON.parse(message).pressed);
    });

    socket.on('close', function(){
        //nothing should be pressed when the websocket closes.
        plc.setPressed([]);
    });

});
//Every 1.5 seconds, ping the clients and terminate unresponsive ones.
const pump_interval = setInterval(function ping(){
    socketServer.clients.forEach(function each(ws){
        if(ws.isAlive === false) return ws.terminate();

        ws.isAlive = false;
        ws.ping(noop);
    });
}, 1500);

//asynchronous function to read all data from a readable stream.
//returns a promise, as it should.
function read_all_data(readable, encoding, byte_cap){
	let data = '';
	return new Promise((resolve, reject)=>{
		readable.on('data', (chunk) =>{
			data += chunk.toString(encoding);
			if(byte_cap !== undefined){
				if(byte_cap <= data.length){
                    let error = new Error("Message past byte cap!");
                    error.partial_message = data;
                    readable.destroy(error);
				}
			}
		});

		readable.on('end', ()=>{
			resolve(data);
		});

		readable.on('error', err => reject(err));
	});
};

//HTTPS server for communicating with webserver
let webserver_comm = https.createServer(https_options, function(req, res){
    if(req.url === '/set_secret' && req.method === 'POST'){
        //Set secret with timeout
        read_all_data(req, 'utf8').then((data)=>{
            let payload = JSON.parse(data);
            if(payload.secret === undefined || payload.expires_in === undefined){
                throw new HTTPError('Bad request; No secret or expires_in sent!', 400);
            }
            //TODO kill current socket connections if a
            //client is connected.
            if(secret_timer != null){
                secret = null;
                clearTimeout(secret_timer);
                secret_timer = null;
            }
            info_logger.info('Got payload: ' + payload);
            //TODO kill current socket connection on timeout;
            secret = payload.secret;
            setTimeout(function(){
                secret_timer = null;
                secret = null;
            }, payload.expires_in);

            res.writeHead(200);
            res.end('Success');
        
        }).catch((err)=>{
            err_logger.error('Error setting secret:' + err);
            
            res.writeHead(err.err_code !== undefined ? err.err_code : 500);
            res.end(err.message);
        });
    }else if(req.url === '/status' && req.method === 'GET'){
        res.writeHead(200);
        if(socketServer.connectionCount > 0){
            res.end('BUSY');
        }else{
            res.end('FREE');
        }
    }
});

//Websocket server
//Change the options so that connections don't require certificates.
https_options.requestCert = false;
https_options.ca = undefined;
https_options.rejectUnauthorized = undefined;

let wsServer = https.createServer(https_options);

wsServer.on('upgrade', function(request, socket, head){
    info_logger.info('Attempting to upgrade to websocket...');

	 //Q:not sure if we want this in the error log or not it seems like error checking tho
    if(secret == null ||  request.url.substring(1).split('/')[0] != encodeURIComponent(secret)){
	    err_logger.error('Invalid incoming secret, refuse to connect.');
        err_logger.error('Sent ' + request.url.substring(1).split('/')[0]);
        err_logger.error('Secret should be ' + secret);
        socket.destroy();
        return;
    }

    if(socketServer.connectionCount > 0){
        err_logger.error('Already a connection.')
        socket.destroy();
        return;
    }

    socketServer.connectionCount++;
    
    socket.on('close', function(code, message){
        socketServer.connectionCount--;
		info_logger.info(
			'Disconnected WebSocket ('+socketServer.connectionCount+' total)'
		);
    });

    socketServer.handleUpgrade(request, socket, head, (ws)=>{
		socketServer.emit('connection', ws, request);
	});

});

wsServer.listen(options['websocket_port']);
webserver_comm.listen(options['socket_port']);

info_logger.info('Arm server listening for webserver on ' + options['socket_port']);

process.on('unhandledRejection', function(reason, promise){
    info_logger.error('Reject promise!');
    info_logger.error(reason);
    info_logger.error(promise);
});

process.on('warning', function(warning){
    info_logger.error('warning: ', warning, warning.stack, warning.message, warning.name);
});

//SIGUSR2 must be used. SIGUSR1 is reserved for node.
//This tells the parent process that the server is started.
if(process.argv.length === 4){
	process.kill(parseInt(process.argv[3]), 'SIGUSR2');
}
