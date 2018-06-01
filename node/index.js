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
const mysql = require('mysql');
const MySQLStore = require('express-mysql-session')(session);

const options = require('./settings.json');
//Create mail connection
let smtpTransport = null;
if(options["smtp_auth"]){
    smtpTransport = nodemailer.createTransport({
        host: options['smtp_host'],
        port: options['smtp_port'],
        secure: options['smtp_tls'],
        auth: {
            user: options['smtp_username'],
            pass: options['smtp_password']
        }
    }); 
}else{
    smtpTransport = nodemailer.createTransport({
        host: options['smtp_host'],
        port: options['smtp_port'],
        secure: options['smtp_tls'],
    });
}
//Print warning for debug option being enabled.
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
//initialize mysqljs stuff.
let mysql_pool = mysql.createPool({
    connectionLimit: 10,
    host: options['mysql_host'],
    user:  options['mysql_user'],
    password: options['mysql_pass'],
    database: options['mysql_db'],
    /*This code snippet found from  https://www.bennadel.com/blog/3188-casting-bit-fields-to-booleans-using-the-node-js-mysql-driver.htm*/
    typeCast: function castField( field, useDefaultTypeCasting ) {
        if (field.type === "BIT" && field.length === 1) {
            let bytes = field.buffer();
            return bytes[0] === 1;

        }

        return useDefaultTypeCasting();
    }
});

user_auth.init_mysql(mysql_pool);
db_fetch.init_mysql(mysql_pool);

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
app.use(bodyParser.json());

app.use(session({
    secret:'alkshflkasf',
    store: session_store,
    resave: false,
    saveUninitialized: false,
    unset: 'destroy',
    cookie:{maxAge: 36000000}
}));

//Static routes (mirrors directory structure for these routes)
app.use('/css', express.static(__dirname + '/www/css'));
app.use('/js', express.static(__dirname +'/www/js'));
app.use('/img', express.static(__dirname +'/www/img'));

//Other routes
app.get('/', function(req, res){
    res.redirect(301, '/Home.html');
});

app.get('/ControlPanel.html', function(req, res){
    res.append('Cache-Control', "no-cache, no-store, must-revalidate");
    if(!req.session.loggedin){
        res.redirect(303, '/Login.html')
        return;
    }
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
            res.status(200).send(html_fetcher(__dirname + '/www/ControlPanel.html', req, {beforeHeader: ()=>{return '<title>Robot Remote - Control Panel</title>'}}));
        },(err) => {
            console.log("Failed to connect to actuator server, " + err)
            res.status(500).send(err);
        });
    },(err)=>{
        res.status(200).send(err);
    });
});

app.get('/Home.html', function(req, res){
    res.status(200).send(html_fetcher(__dirname + '/www/Home.html', req));
});

app.get('/Login.html', function(req, res){
    let opts = {};
    
    if(req.session.login_error){
        let err_str = req.session.login_error;
        opts.afterNavbar = ()=>('<input id="errmsg" type="hidden" value="' + err_str + '"/>');
        req.session.login_error = undefined;
    }

    res.status(200).send(html_fetcher(__dirname + '/www/Login.html', req, opts));
});

app.post('/Login.html', function(req, res){
    res.append('Cache-Control', "no-cache, no-store, must-revalidate");
    if(req.session.email){
        res.status(200).send('Already logged in, log out first.');
        return;
    }
    
    if(!req.body.username || !req.body.password){
        res.status(200).send('Missing username or password');
        return;
    }

    user_auth.verify_credentials(req.body.username, req.body.password).then((info)=>{
        req.session.loggedin = true;
        req.session.email = req.body.username;
        req.session.is_admin = info.is_admin;
        req.session.user_id = info.id;
        console.log("Logged in :" );
        console.log(req.session);
        res.redirect(302, '/Scheduler.html');
    },(err)=>{
        console.log('Error verifying user '  + req.body.username + ': ' + err.reason);
        //set session error. Login.html can ask for it.
        req.session.login_error = err.client_reason;
        res.redirect(303, '/Login.html');
    });
});

app.get('/Logout', function(req, res){
    res.append('Cache-Control', "no-cache, no-store, must-revalidate");
    req.session.loggedin = false;
    delete req.session;
    res.redirect(303, '/Home.html');
});

app.get('/sessioninfo', function(req, res){
    res.append('Cache-Control', "no-cache, no-store, must-revalidate");
    res.status(200).send(req.session.email + ", admin: " + req.session.is_admin + ", user_id: " + req.session.user_id);
});

app.get('/Request.html', function(req, res){
    res.status(200).send(html_fetcher(__dirname + '/www/Request.html', req));
});

app.post('/Request.html', function(req, res){
    /*Email regex, ripped off https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/email#Validation  */
    const email_regex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    res.append('Cache-Control', "no-cache, no-store, must-revalidate");
    
    if(!req.body.username || !req.body.password || !req.body.reason){
        res.status(400).send('Missing email, password, or reason for request.');
        return;
    }

    if(!email_regex.test(req.body.username)){
        res.satus(400).send('Invalid email.');
        return;
    }
    //TODO password tests? (length, numbers, symbols maybe?)

    user_auth.login_request(req.body.username, req.body.password, req.body.reason)
        .then((email_token)=>{
            res.status(200).send('success!');
            let link = options['domain_name'] + "/verify?email=" + encodeURIComponent(req.body.username) + "&email_tok=" + encodeURIComponent(email_token);
            
            let mailOptions = {
                to : req.body.username,
                from : options['mailer_email'],
                subject : "Please confirm your Email account",
                html : "Hello,<br> Please Click on the link to verify your email.<br><a href="+link+">Click here to verify</a>",	
                text : "Hello, Please visit the following URL to verify your email." + link
            }
            
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
        		res.status(500).send(err.client_reason);
        });
});

app.get('/Scheduler.html', function(req, res){
    res.append('Cache-Control', "no-cache, no-store, must-revalidate");
    console.log("Called scheduler");
    if(!req.session.loggedin){
        res.redirect(303, '/Login.html')
        return;
    }
    
    res.send(html_fetcher(__dirname + '/www/Scheduler.html', req));
});

app.get('/verify', function(req,res){
    res.append('Cache-Control', "no-cache, no-store, must-revalidate");
    user_auth.email_verify(req.query.email, req.query.email_tok).then(function(){
		let admin_link = options['domain_name'] + "/admin/Admin.html"; 
        
        smtpTransport.sendMail({
            to: options['admin_email'],
            from: options['mailer_email'],
            subject: "User " + req.query.email + " Verified.",
            html: "User " + req.query.email + " has verified their email. Please visit <a href='" + admin_link + "'> the admin control panel </a> to verify."
        }).then((res)=>{
            console.log("Sent mail to admin.");    
        }, (err)=>{
            console.log('Failed to send mail to admin!');
            console.log(err);
        });
        
        res.redirect(303, '/Login.html');
	},function(error){
	   console.log(error.reason);
       console.log(error.db_err);
       res.status(200).send('Error verifying email, ' + error.client_reason);
	});
});

app.get('/admin/Admin.html', function(req, res){
    res.append('Cache-Control', "no-cache, no-store, must-revalidate");
    if(!req.session.loggedin){
        res.redirect(302, '/Login.html');
        return;
    }
    if(req.session.is_admin === undefined){
        res.redirect(302, '/Login.html');
        return;
    }
    if(!req.session.is_admin){
        res.redirect(302, '/Home.html');
        return;
    }
    //emit admin page
    res.status(200).send(html_fetcher(__dirname + '/www/Admin.html', req));
});
/*Returns JSON encoded list of requests:
    {
        id:  <id for request>
        email: <email>,
        reason: <reason>
    }
*/
app.get('/admin/loginrequests', function(req, res){
    res.append('Cache-Control', "no-cache, no-store, must-revalidate");
    if(!req.session.loggedin){
        res.redirect(302, '/Login.html');
        return;
    }
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
    partitioned into 2 lists, one with approved requests,
    one with unapproved requests.
*/
app.get('/admin/timeslotrequests', function(req, res){
    res.append('Cache-Control', "no-cache, no-store, must-revalidate");
    if(!req.session.loggedin){
        res.redirect(302, '/Login.html');
        return;
    }
    if(req.session.is_admin === undefined){
        res.redirect(302, '/Login.html');
        return;
    }
    if(!req.session.is_admin){
        res.redirect(302, '/Home.html');
        return;
    }
    
    db_fetch.admin_get_timeslot_requests(new Date(Date.now()), new Date(Date.now() + 7*24*60*60*1000)).then((val)=>{
        res.status(200).json(val);
    }, (err) => {
        console.log(err);
        res.status(500).send(err.client_reason);
    })

});
/* 
    Request to reject login request with given id
*/
app.get('/admin/rejectloginrequest/:id', function(req, res){
    res.append('Cache-Control', "no-cache, no-store, must-revalidate");
    if(!req.session.loggedin){
        res.redirect(302, '/Login.html');
        return;
    }
    if(req.session.is_admin === undefined){
        res.redirect(302, '/Login.html');
        return;
    }
    if(!req.session.is_admin){
        res.redirect(302, '/Home.html');
        return;
    }

    db_fetch.delete_timeslotrequest_admin(req.params.id).then(async function(user_id){
        try{
            let user = await db_fetch.get_user_by_id(user_id);
            let mailOptions = {
                to : user.email,
                from : options['mailer_email'],
                subject : "Timeslot Request Rejected",
                html : "Hello,<br> We regret to inform you that one of your timeslot requests has been rejected.",	
            }
            
            smtpTransport.sendMail(mailOptions, function(error, response){
                if(error){
                    console.log(error);
                    res.end("error");
                }else{
                    console.log("Message sent: " + response.message);
                    res.end("sent");
                    }
            });
            
            res.status(200).send("Success");

        }catch(err){
            res.status(500).send(err.client_reason);    
        }
    }, (err)=>{
        console.log(err);
        res.status(500).send(err.client_reason);
    });

});
/* 
    Request to accept login request with given id
*/
app.get('/admin/acceptloginrequest/:id', function(req, res){
    res.append('Cache-Control', "no-cache, no-store, must-revalidate");
    if(!req.session.loggedin){
        res.redirect(302, '/Login.html');
        return;
    }
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
    res.append('Cache-Control', "no-cache, no-store, must-revalidate");
    if(!req.session.loggedin){
        res.redirect(302, '/Login.html');
        return;
    }
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
    res.append('Cache-Control', "no-cache, no-store, must-revalidate");
    if(!req.session.loggedin){
        res.redirect(302, '/Login.html');
        return;
    }
    if(req.session.is_admin === undefined){
        res.redirect(302, '/Login.html');
        return;
    }
    if(!req.session.is_admin){
        res.redirect(302, '/Home.html');
        return;
    }
});

/*Returns JSON encoded list of requests:
    {
        starttime: <datetime>,
        duration: <duration in seconds>
        accepted: <bool>
    }
*/
app.get('/timeslotrequests', function(req, res){
    res.append('Cache-Control', "no-cache, no-store, must-revalidate");
    if(!req.session.loggedin){
        //not logged in
        res.status(403).send('Not logged in!');
        return;
    }
    
    let now_ms = Date.now();
    let week_later_ms = now_ms + (24*60*60*1000)*7;

    db_fetch.user_get_timeslot_requests(new Date(now_ms), new Date(week_later_ms), req.session.user_id).then((json)=>{
        res.status(200).json(json);
    },(err)=>{
        console.log('Error fetching timeslot requests: ' + err.reason);
        console.log(err.db_err);
        res.status(500).send(err.client_reason);
    });

});
/*
    Endpoint for timeslot request. Client needs to 
    provide start time in milliseconds since the unix epoch, and duration in milliseconds.
*/
//These should match the ones in scheduler.js
const time_quantum = 60;
const max_quantums = 8;
const num_days = 7;

app.post('/requesttimeslot', function(req, res){
    res.append('Cache-Control', "no-cache, no-store, must-revalidate"); 
    if(!req.session.loggedin){
        res.status(403).send('Not logged in!');
        return;
    }

    if(req.body.start_time === undefined || req.body.duration === undefined){
        res.status(400).send('Missing request paramaters.');
        return;
    }

    if(typeof req.body.start_time !== 'number' || typeof req.body.duration !== 'number'){
        res.status(400).send('Invalid request paramaters.');
        return;
    }

    if(req.body.start_time < Date.now()){
        res.status(400).send('Start time before current time.');
        return;
    }

    if(req.body.start_time > Date.now() + num_days*24*60*60*1000){
        res.status(400).send('Requested date too far in the future.');
        return;
    }

    let date = new Date(req.body.start_time);
    //TODO make this check more robust
    //This should check that it starts on a time quantum
    if((date.getMinutes() % time_quantum) != 0){
        res.status(400).send('Requested time not a multiple of the time quantum');
        return;
    }

    if((req.body.duration / (1000 * 60)) % time_quantum != 0){
        res.status(400).send('Bad duration (not a multiple of the time quantum)');
        return;
    }

    if(req.body.duration > max_quantums*time_quantum*60*1000){
        res.status(400).send('Bad duration (duration too large)');
        return;
    }

    db_fetch.add_request(date, (req.body.duration / 1000) - 1, req.session.user_id).then((val) => {
        res.status(200).send("Success");

        let admin_link = options['domain_name'] + "/admin/Admin.html"; 
        
        smtpTransport.sendMail({
            to: options['admin_email'],
            from: options['mailer_email'],
            subject: "User " + req.query.email + " Requested a timeslot.",
            html: "User " + req.query.email + " has requeste a timeslot. Please visit <a href='" + admin_link + "'> the admin control panel </a> to accept or reject."
        }).then((res)=>{
            console.log("Sent mail to admin.");    
        }, (err)=>{
            console.log('Failed to send mail to admin!');
            console.log(err);
        });

    }, (err)=>{
        console.log(err);
        res.status(500).send(err.client_reason);
    });

});

//This endpoint deletes the request with id,
//only if the logged in user made it.
app.get('/deletetimeslot/:id', function(req, res){
    if(!req.session.loggedin){
        res.status(403).send("Not logged in!");
        return;
    }

    db_fetch.delete_request(req.params.id, req.session.user_id).then(()=>{
        res.status(200).send('Success');
    },(err)=>{
        console.log(err);
        res.status(500).send(err.client_reason);
    });
});
/* 404 page. Can support other errors, technically, but currently is not used for anything else.*/
app.all('*', function(req, res){
	let opts = { };
    
    if(req.session.error_status === undefined){
      req.session.error_status = 404;
    }
    
	let err_str = req.session.error_str ? req.session.error_str : 'Page Not Found';
    
    opts.afterNavbar = ()=>('<input id="errmsg" type="hidden" value="' + err_str + '"/>');
   
	res.status(req.session.error_status).send(html_fetcher(__dirname + '/www/Error.html', req, opts));
	req.session.error_status = undefined;
});

let server = app.listen(3000, () => console.log("Listening on port 3k"));
