const express = require("express");
const request = require('request');
const app = express();
const tls = require('tls');
const net = require('net');
const fs = require('fs');
const actuator_comm = require('./actuator_comm');

const options = require('./settings.json');

//load private key into memory
let my_key = fs.readFileSync(options['key_file']);
let cert = fs.readFileSync(options['cert_file']);
let cacert = fs.readFileSync(options['ca_file']);
let actuators = [];

//initialize actuators
for(let act of options['actuator_servers']){
    actuators.push(new actuator_comm.Actuator(act.ip, act.socket_port))
}
//routing
//app.use('/static', express.static('./www'));

app.get('/', function(req, res){
    console.log("Redirect from / to /static/");
    res.redirect(301, '/static/');
});

app.get('/static/', function(req, res){
    console.log("Connecting to main page");
    let act = actuator_comm.getFreeActuator(actuators);
    if(act == null){
        res.send("No free actuators!");
    }else{
        //TODO set cookie pointing to actuator
        //TODO write out HTML (read from disk and send)
        //send client details.
        act.sendClientDetails(cert, my_key, cacert).then((val) => {
            res.send('Connected to actuator server.');
        },(err) => {
            console.log("Failed to connect to actuator server, " + err)
            res.send(err);
        });
    }
});

let server = app.listen(3000, () => console.log("Listening on port 3k"));
