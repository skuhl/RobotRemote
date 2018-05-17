const express = require("express");
const request = require('request');
const app = express();
const tls = require('tls');
const net = require('net');
const fs = require('fs');
const actuator_comm = require('./actuator_comm');

const options = require('./settings.json');

if(options['debug']){
    console.log('WARNING: Server was started in debug mode. This is insecure, and meant only for testing purposes.');
}

//load ssl stuff into mem.
let my_key = fs.readFileSync(options['key_file']);
let cert = fs.readFileSync(options['cert_file']);
let cacert = fs.readFileSync(options['ca_file']);

let secure_context = null;

if(options['debug']){
    secure_context = tls.createSecureContext({
        rejectUnauthorized: false,
        requestCert: false
    });
}else{
    secure_context = tls.createSecureContext({
        key: my_key,
        cert: cert,
        ca: cacert,
        rejectUnauthorized: true,
        requestCert: true
    });
}
let actuators = [];

//initialize actuators
for(let act of options['actuator_servers']){
    actuators.push(new actuator_comm.Actuator(act.ip, act.socket_port, secure_context))
}
//routing
//app.use('/public', express.static('./www'));

app.get('/', function(req, res){
    console.log("Redirect from / to /static/");
    res.redirect(301, '/www/');
});

app.get('/www/index.html', function(req, res){
    console.log("Connecting to main page");
    actuator_comm.getFreeActuator(actuators).then((act)=>{
        //send client details.
        act.sendClientDetails().then((secret) => {
            //send cookie containing client secret!
            //TODO set up these options for cookie correctly
            //(https only, age, when it expires, possibly session stuff)
            res.cookie('act-secret', secret);
            res.send(fs.readFileSync('./www/index.html', {
                encoding: 'utf8'
            }));
        },(err) => {
            console.log("Failed to connect to actuator server, " + err)
            res.send(err);
        });
    },(err)=>{
        res.send(err);
    });
});

app.get('/www/*', function(req, res){
    //TODO FIXME THIS IS BAD, JUST FOR TESTING PURPOSES
    //ALLOWS ACCESS OF FILES OUTSIDE OF WWW
    if(fs.existsSync(__dirname + req.path)){
        res.send(fs.readFileSync(__dirname + req.path, {
            encoding: 'utf8'
        }));
    }else{
        res.status(404).send('Could not find requested file.');
    }
});

let server = app.listen(3000, () => console.log("Listening on port 3k"));
