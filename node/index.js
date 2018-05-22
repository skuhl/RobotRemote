const express = require("express");
const request = require('request');
const app = express();
const tls = require('tls');
const net = require('net');
const fs = require('fs');
const actuator_comm = require('./actuator_comm');
const user_auth = require('./user_auth.js');
const bodyParser = require('body-parser')

const options = require('./settings.json');

if(options['debug']){
    console.log('WARNING: Server was started in debug mode. This is insecure, and meant only for testing purposes.');
}

//load ssl stuff into mem.
let my_key = fs.readFileSync(options['key_file']);
let cert = fs.readFileSync(options['cert_file']);
let cacert = fs.readFileSync(options['ca_file']);

let secure_context = null;

user_auth.init_mysql(options['mysql_host'], options['mysql_user'], options['mysql_pass'], options['mysql_db']);

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
    actuators.push(new actuator_comm.Actuator(act.ip, act.socket_port, act.websock_port, act.web_cams, my_key, cert, cacert));
}
//middleware
app.use(bodyParser.urlencoded({extended: false}));
//routing
app.use('/css', express.static('./www/css'));
app.use('/js', express.static('./www/js'));

app.get('/', function(req, res){
    console.log("Redirect from / to /static/");
    res.redirect(301, '/Home.html');
});

app.get('/ControlPanel.html', function(req, res){
    console.log("Connecting to main page");
    actuator_comm.getFreeActuator(actuators).then((act)=>{
        //send client details (secret).
        act.sendClientDetails().then((secret) => {
            //send cookie containing client secret!
            //TODO set up these options for cookie correctly
            //(https only, age, when it expires, possibly session stuff)
            res.cookie('act-url', act.ip + ":" + act.websock_port + "/")
            res.cookie('act-secret', secret);

            //TODO Spin up every webcam (probably in the actuator_comm code)
            //This probably means having some small server listen for messages,
            //meaning an extra parameter for each webcam.
            for(let i = 0; i < act.webcams.length; i++){
                res.cookie("webcam-" + (i+1), act.webcams[i].ip + ':' +  act.webcams[i].port);
                //TODO generate unique secrets, send them to webcams, set the cookies to them
                res.cookie("webcam"+ (i+1) + "-secret", "secret");
            }

            res.send(fs.readFileSync('./www/ControlPanel.html', {
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

app.get('/Home.html', function(req, res){
    res.send(fs.readFileSync('./www/Home.html', {
        encoding: 'utf8'
    }));
});

app.get('/Login.html', function(req, res){
    res.send(fs.readFileSync('./www/Login.html', {
        encoding: 'utf8'
    }));
});

app.post('/Login.html', function(req, res){
    console.log(req.body);
    if(!req.body.username || !req.body.password){
        res.send('Missing username or password');
        return;
    }
    user_auth.verify_credentials(req.query.username, req.query.password).then(()=>{
        //TODO this should probably redirect to the scheduler or something.
        res.send('Verified!');
    },(err)=>{
        res.send('Error: ' + err.client_reason);
    });
});

app.get('/Request.html', function(req, res){
    res.send(fs.readFileSync('./www/Request.html', {
        encoding: 'utf8'
    }));
});

app.get('/Scheduler.html', function(req, res){
    res.send(fs.readFileSync('./www/Scheduler.html', {
        encoding: 'utf8'
    }));
});

app.get('/NavBar.html', function(req, res){
    res.send(fs.readFileSync('./www/NavBar.html', {
        encoding: 'utf8'
    }));
});

let server = app.listen(3000, () => console.log("Listening on port 3k"));
