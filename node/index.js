let express = require("express");
var request = require('request');
let app = express();
let WebSocketServer = require('websocket').server;
let net = require('net')

app.use('/static', express.static('./www'));
app.get('/', function(req, res){
    console.log("Redirect from / to /static/");
    res.redirect(301, '/static/');
});

let server = app.listen(3000, () => console.log("Listening on port 3k"));
//console.log(app);

wsServer = new WebSocketServer({
    httpServer: server,
    keepalive: true,
    keepaliveInterval: 2000,
    keepaliveGracePeriod: 1000,
    closeTimeout: 1000,
    autoAcceptConnections: false
});

wsServer.on('request', function(req){
    console.log("Request gotten.");
    let con = req.accept(null, req.origin);
    con.on('message', function(message){
        con.sendUTF('Echo: ' + message.utf8Data);
        //Make a request to python stuff
        /*
        request.post(
            'http://localhost:5000/extend',
            {json: JSON.parse(message.utf8Data)},
            function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log(body)
                }
            }
        );*/
        socket = net.createConnection(5000, 'localhost', function(){
            //Send a singular message, and end the connection
            console.log("Sending" + message.utf8Data);
            socket.end(message.utf8Data);
        })
        
    });
    con.on('close', function(reason, desc){
        console.log('Client diconnected, because: ' + desc);
    });
});

wsServer.on('connect', function(con){
    //console.log(con);
    console.log("Connected");
});

wsServer.on('close', function(con, reason, desc){
    console.log("Disconnected");
    //console.log(con, reason, desc);
});