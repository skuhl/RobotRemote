const express = require("express");
var nodemailer = require("nodemailer");
const request = require('request');
const app = express();
const tls = require('tls');
const net = require('net');
const fs = require('fs');
const actuator_comm = require('./actuator_comm');
const user_auth = require('./user_auth.js');
const db_fetch = require('./db_fetch.js');
const html_fetcher = require('./html_fetcher');
const bodyParser = require('body-parser')
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const options = require('./settings.json');

const smtpTransport = nodemailer.createTransport({
    host: options['smtp_host'],
    port: options['smtp_port'],
    secure: options['smtp_tls'],
    auth: {
        user: options['smtp_username'],
        pass: options['smtp_password']
    }
});

if(options['debug']){
    console.log('WARNING: Server was started in debug mode. This is insecure, and meant only for testing purposes.');
}

//load ssl stuff into mem.
let my_key = fs.readFileSync(options['key_file']);
let cert = fs.readFileSync(options['cert_file']);
let cacert = fs.readFileSync(options['ca_file']);

let secure_context = null;

user_auth.init_mysql(options['mysql_host'], options['mysql_user'], options['mysql_pass'], options['mysql_db']);
db_fetch.init_mysql(options['mysql_host'], options['mysql_user'], options['mysql_pass'], options['mysql_db']);

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
let session_store = new MySQLStore({
    host: options['mysql_host'],
    port: 3306,
    user: options['mysql_user'],
    password: options['mysql_pass'],
    database: "sessions"
});

app.use(bodyParser.urlencoded({extended: false}));
app.use(session({
    secret:'alkshflkasf',
    store: session_store,
    resave: false,
    saveUninitialized: false,
    unset: 'destroy',
    cookie:{maxAge: 36000000}
}));

//routing
app.use('/css', express.static(__dirname + '/www/css'));
app.use('/js', express.static(__dirname +'/www/js'));
app.use('/img', express.static(__dirname +'/www/img'));

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
            res.status(200).send(html_fetcher(__dirname + '/www/ControlPanel.html', {beforeHeader: ()=>{return '<title>Robot Remote - Control Panel</title>'}}));
        },(err) => {
            console.log("Failed to connect to actuator server, " + err)
            res.status(500).send(err);
        });
    },(err)=>{
        res.status(200).send(err);
    });
});

app.get('/Home.html', function(req, res){
    res.status(200).send(html_fetcher(__dirname + '/www/Home.html'));
});

app.get('/Login.html', function(req, res){
    let opts = {};
    
    if(req.session.login_error){
        let err_str = req.session.login_error;
        opts.afterNavbar = ()=>('<input id="errmsg" type="hidden" value="' + err_str + '"/>');
        req.session.login_error = undefined;
    }

    res.status(200).send(html_fetcher(__dirname + '/www/Login.html', opts));
});

app.post('/Login.html', function(req, res){
    if(req.session.email){
        res.status(200).send('Already logged in, log out first.');
        return;
    }
    
    if(!req.body.username || !req.body.password){
        res.status(200).send('Missing username or password');
        return;
    }

    user_auth.verify_credentials(req.body.username, req.body.password).then((is_admin)=>{
        req.session.email = req.body.username;
        req.session.is_admin = is_admin;
        res.redirect(302, '/Scheduler.html');
    },(err)=>{
        console.log('Error verifying user '  + req.body.username + ': ' + err.reason);
        //set session error. Login.html can ask for it.
        req.session.login_error = err.client_reason;
        res.redirect(303, '/Login.html');
    });
});

app.get('/Logout', function(req, res){
    delete req.session;
    res.status(200).send('deleted session');
});

app.get('/sessioninfo', function(req, res){
    res.status(200).send(req.session.email + ", admin: " + req.session.is_admin);
});

app.get('/Request.html', function(req, res){
    res.status(200).send(html_fetcher(__dirname + '/www/Request.html'));
});

app.post('/Request.html', function(req, res){
    if(!req.body.username || !req.body.password || !req.body.reason){
        res.status(200).send('Missing username, password, or reason for request.');
        return;
    }

    user_auth.login_request(req.body.username, req.body.password, req.body.reason)
        .then((email_token)=>{
            res.status(200).send('Succesfully added user to DB, awaiting approval.');
            let link = options['domain_name'] + "/verify?email=" + encodeURIComponent(req.body.username) + "&email_tok=" + encodeURIComponent(email_token);
            mailOptions={
					to : req.body.username,
					from : options['mailer_email'],
					subject : "Please confirm your Email account",
					html : "Hello,<br> Please Click on the link to verify your email.<br><a href="+link+">Click here to verify</a>",	
                    text : "Hello, Please visit the following URL to verify your email." + link
                }
				console.log(mailOptions);
				smtpTransport.sendMail(mailOptions, function(error, response){
			   	 if(error){
			        	console.log(error);
						res.end("error");
				 	}else{
			        	console.log("Message sent: " + response.message);
						res.end("sent");
			    	 }
				});
        }, (err)=>{
            res.status(200).send('Error adding user to DB, ' + err.client_reason);
        });
});

app.get('/Scheduler.html', function(req, res){
    res.send(html_fetcher(__dirname + '/www/Scheduler.html'));
});

app.get('/verify', function(req,res){
	user_auth.email_verify(req.query.email, req.query.email_tok).then(function(){
		res.status(200).send('email veirfied');
	},function(error){
	   console.log(error.reason);
       console.log(error.db_err);
       res.status(200).send('Error verifying email, ' + error.client_reason);
	});
});

app.get('/admin/Admin.html', function(req, res){
    if(req.session.is_admin === undefined){
        res.redirect(302, '/Login.html');
        return;
    }
    if(!req.session.is_admin){
        res.redirect(302, '/Home.html');
        return;
    }
    //emit admin page
    res.send('Admin page');
});
/*Returns JSON encoded list of requests:
    {
        id:  <id for request>
        email: <email>,
        reason: <reason>
    }
*/
app.get('/admin/loginrequests', function(req, res){
    if(req.session.is_admin === undefined){
        res.redirect(302, '/Login.html');
        return;
    }
    if(!req.session.is_admin){
        res.redirect(302, '/Home.html');
        return;
    }
    db_fetch.get_login_requests(0, -1).then((json)=>{
        res.status(200).json({requests: json});
    }, (err)=>{
        res.status(500).send('Error getting login requests');
        console.log(err.db_err);
    });
});

/*Returns JSON encoded list of requests:
    {
        id: <id for request>
        email: <email>,
        starttime: <datetime>,
        duration: <duration in seconds>
    }
*/
app.get('/admin/timeslotrequests', function(req, res){
    if(req.session.is_admin === undefined){
        res.redirect(302, '/Login.html');
        return;
    }
    if(!req.session.is_admin){
        res.redirect(302, '/Home.html');
        return;
    }
});
/* 
    Request to reject login request with given id
*/
app.get('/admin/rejectloginrequest/:id', function(req, res){
    if(req.session.is_admin === undefined){
        res.redirect(302, '/Login.html');
        return;
    }
    if(!req.session.is_admin){
        res.redirect(302, '/Home.html');
        return;
    }
});
/* 
    Request to accept login request with given id
*/
app.get('/admin/acceptloginrequest/:id', function(req, res){
    if(req.session.is_admin === undefined){
        res.redirect(302, '/Login.html');
        return;
    }
    if(!req.session.is_admin){
        res.redirect(302, '/Home.html');
        return;
    }
});
/* 
    Request to reject timeslot request with given id
*/
app.get('/admin/rejecttimeslotrequest/:id', function(req, res){
    if(req.session.is_admin === undefined){
        res.redirect(302, '/Login.html');
        return;
    }
    if(!req.session.is_admin){
        res.redirect(302, '/Home.html');
        return;
    }
});
/* 
    Request to accept timeslot request with given id
*/
app.get('/admin/accepttimeslotrequest/:id', function(req, res){
    if(req.session.is_admin === undefined){
        res.redirect(302, '/Login.html');
        return;
    }
    if(!req.session.is_admin){
        res.redirect(302, '/Home.html');
        return;
    }
});

app.get('*', function(req, res){
	let opts = { };
	if(req.session.error_status === undefined){
      req.session.error_status = 404;
	}
	let err_str = 'Page Not Found';
   opts.afterNavbar = ()=>('<input id="errmsg" type="hidden" value="' + err_str + '"/>');
   
	res.status(req.session.error_status).send(html_fetcher(__dirname + '/www/Error.html', opts));
	req.session.error_status = undefined;
});

app.post('*', function(req, res){
	
});
let server = app.listen(3000, () => console.log("Listening on port 3k"));
