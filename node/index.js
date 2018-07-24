const express = require("express");
const request = require('request');
const http = require('http');
const https = require('https');
const tls = require('tls');
const net = require('net');
const fs = require('fs');
const mail = require('./mail');
const actuator_comm = require('./actuator_comm');
const webcam_comm = require('./webcam_comm');
const user_auth = require('./user_auth.js');
const db_fetch = require('./db_fetch.js');
const html_fetcher = require('./html_fetcher');
const bodyParser = require('body-parser')
const session = require('express-session');
const mysql = require('mysql2/promise');
const MySQLStore = require('express-mysql-session')(session);
const log4js = require('log4js');
const log4js_template = require('../common/log4jstemplate');
const client_utils = require('./www/js/utils.js');
const scheduler_generator = require('./scheduler_generator');

function getDefaultIfUndefined(curval, default_){
    return curval === undefined ? default_ : curval; 
}

class RobotRemoteServer {
    constructor(options){
        this._options = options;
        this._options.http_port = getDefaultIfUndefined(this._options.http_port, 3000);
        this._options.https_port = getDefaultIfUndefined(this._options.https_port, 3001);
        this._options.mysql_host = getDefaultIfUndefined(this._options.mysql_host, 'localhost');
        this._options.mysql_user = getDefaultIfUndefined(this._options.mysql_user, 'RobotRemote');
        this._options.mysql_port = getDefaultIfUndefined(this._options.mysql_port, 3306);
        this._options.mysql_db = getDefaultIfUndefined(this._options.mysql_db, 'RobotRemote');
        this._options.actuator_servers = getDefaultIfUndefined(this._options.actuator_servers, []);

        for(let act of this._options.actuator_servers){
            act.ip = getDefaultIfUndefined(act.ip, '127.0.0.1');
            act.socket_port = getDefaultIfUndefined(act.socket_port, 3002);
            act.websock_port = getDefaultIfUndefined(act.websock_port, 3003);
            act.web_cams = getDefaultIfUndefined(act.web_cams, []);
            for(let web_cam of act.web_cams){
                web_cam.ip = getDefaultIfUndefined(web_cam.ip, '127.0.0.1');
                web_cam.websock_port = getDefaultIfUndefined(web_cam.websock_port, 3005);
                web_cam.secure = getDefaultIfUndefined(web_cam.secure, true);
                web_cam.comm_port = getDefaultIfUndefined(web_cam.comm_port, 3007);
            }
        }

        this._options.client_cert_file = getDefaultIfUndefined(this._options.client_cert_file, 'cert/client_cert.pem');
        this._options.client_key_file = getDefaultIfUndefined(this._options.client_key_file, 'cert/client_key.pem');
        this._options.server_cert_file = getDefaultIfUndefined(this._options.server_cert_file, 'cert/server_cert.pem');
        this._options.server_key_file = getDefaultIfUndefined(this._options.server_key_file, 'cert/server_key.pem');
        this._options.ca_file = getDefaultIfUndefined(this._options.ca_file, 'cert/cacert.pem');
        this._options.smtp_auth = getDefaultIfUndefined(this._options.smtp_auth, false);
        this._options.smtp_username = getDefaultIfUndefined(this._options.smtp_username, '');
        this._options.smtp_password = getDefaultIfUndefined(this._options.smtp_password, '');
        this._options.smtp_host = getDefaultIfUndefined(this._options.smtp_host, 'smtp.gmail.com');
        this._options.smtp_port = getDefaultIfUndefined(this._options.smtp_port, 587);
        this._options.smtp_tls = getDefaultIfUndefined(this._options.smtp_tls, true);
        this._options.mailer_email = getDefaultIfUndefined(this._options.mailer_email, 'RobotRemote@robotremote.com');
        this._options.domain_name = getDefaultIfUndefined(this._options.domain_name, 'http://localhost');
        this._options.domain_name_secure = getDefaultIfUndefined(this._options.domain_name_secure, 'https://' + this._options.domain_name.replace('http://'));
        this._options.log_level = getDefaultIfUndefined(this._options.log_level, 'info');
        this._options.multiprocess_logging = getDefaultIfUndefined(this._options.multiprocess_logging, true);
        this._options.multiprocess_logging_port = getDefaultIfUndefined(this._options.multiprocess_logging_port, 10000);

        function get_file_relative_dirname(str){
            if(str.startsWith('/')){
                return str;
            }
            return __dirname + '/' + str;
        }
    
        //load ssl stuff into mem.
        this._client_key = fs.readFileSync(get_file_relative_dirname(this._options['client_key_file']));
        this._client_cert = fs.readFileSync(get_file_relative_dirname(this._options['client_cert_file']));
        this._server_key = fs.readFileSync(get_file_relative_dirname(this._options['server_key_file']));
        this._server_cert = fs.readFileSync(get_file_relative_dirname(this._options['server_cert_file']));
        this._cacert = fs.readFileSync(get_file_relative_dirname(this._options['ca_file']));

        this._secure_context = tls.createSecureContext({
            key: this._client_key,
            cert: this._client_cert,
            ca: this._cacert,
            rejectUnauthorized: true,
            requestCert: true
        });
    
        //initialize mysqljs stuff.
        this._mysql_pool = mysql.createPool({
            connectionLimit: 10,
            host: this._options['mysql_host'],
            user:  this._options['mysql_user'],
            port: this._options['mysql_port'],
            password: this._options['mysql_pass'],
            database: this._options['mysql_db'],
            /*This code snippet found from  https://www.bennadel.com/blog/3188-casting-bit-fields-to-booleans-using-the-node-js-mysql-driver.htm*/
            typeCast: function( field, useDefaultTypeCasting ) {
                if (field.type === "BIT" && field.length === 1) {
                    let bytes = field.buffer();
                    return bytes[0] === 1;
                }
    
                return useDefaultTypeCasting();
            }
        });
    
        //mail
        if(options["smtp_auth"]){        
            mail.init_mail(this._mysql_pool, this._options['mailer_email'], this._options['smtp_host'], this._options['smtp_port'],  this._options['smtp_tls'], {
                user: this._options['smtp_username'],
                pass: this._options['smtp_password']
            });
        }else{
            mail.init_mail(this._mysql_pool, this._options['mailer_email'], this._options['smtp_host'], this._options['smtp_port'],  this._options['smtp_secure']);
        }
    
        user_auth.init_mysql(this._mysql_pool);
        db_fetch.init_mysql(this._mysql_pool);
    
        this._actuators = [];
    
        //initialize actuators
        for(let act of this._options['actuator_servers']){
            let act_inst = new actuator_comm.Actuator(act.ip, act.socket_port, act.websock_port, this._client_key, this._client_cert, this._cacert);
            
            for(let cam of act.web_cams){
                let web_cam = new webcam_comm.Webcam(act_inst, cam.ip, cam.comm_port, cam.websock_port, cam.secure, this._client_key, this._client_cert, this._cacert);
                act_inst.addWebcam(web_cam);
            }
    
            this._actuators.push(act_inst);
        }
        //Loggings
        let appenders = {
            info_log: { type: 'file', filename: 'info.log', layout: log4js_template },
            info_log_nolayout: { type: 'file', filename: 'info.log', layout: { type: 'messagePassThrough' } },
            err_log: { type: 'file', filename: 'err.log', layout: log4js_template },
            err_log_nolayout: { type: 'file', filename: 'err.log', layout: { type: 'messagePassThrough' } },
        };

        if(this._options.multiprocess_logging){
            appenders.multiprocess = {type: 'multiprocess', mode: 'master', appender:'info_log_nolayout', loggerPort: this._options.multiprocess_logging_port};
        }

        log4js.configure({
            appenders: appenders,
            categories: {
                default: {appenders: ['info_log'], level: this._options.log_level}
            }
        });
        
        this.info_logger = log4js.getLogger('default');
        this.err_logger = log4js.getLogger('default');
    }

    initApp(){
        this._app = express();
        //middleware
        this._session_store = new MySQLStore({
            host: this._options['mysql_host'],
            port: 3306,
            user: this._options['mysql_user'],
            password: this._options['mysql_pass'],
            database: "sessions",
            createDatabaseTable: true
        });
    
        this._app.use(bodyParser.urlencoded({extended: false}));
        this._app.use(bodyParser.json());
        
        this._app.use(log4js.connectLogger(this.info_logger, {level: 'auto'}));

        this._app.use(session({
            secret:'alkshflkasf',
            store: this._session_store,
            resave: false,
            saveUninitialized: false,
            unset: 'destroy',
            cookie:{maxAge: 36000000}
        }));
    }

    //These actually return pages
    registerAppRoutes(){
        
        let self = this;
        //Static routes (mirrors directory structure for these routes)
        this._app.use('/css', express.static(__dirname + '/www/css'));
        this._app.use('/js', express.static(__dirname +'/www/js'));
        this._app.use('/img', express.static(__dirname +'/www/img'));

        //Other routes
        this._app.get('/', function(req, res){
            res.redirect(301, '/Home.html');
        });
        
        this._app.get('/ControlPanel.html', function(req, res){
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            if(!req.session.loggedin){
                res.redirect(303, '/Login.html');
                return;
            }
        
            if(!req.secure){
                res.redirect(301, self._options['domain_name_secure'] + req.originalUrl);
                return;
            }
            
            db_fetch.get_user_by_email(req.session.email).then(function(user){
	                db_fetch.check_user_access(user.id).then(function(allow){
	                	this.info_logger.info(allow);
	                		if(allow){
	                			actuator_comm.getFreeActuator(self._actuators).then((act)=>{
                                this.info_logger.info(act);
				                //send client details (secret).
				                act.sendClientDetails(allow*1000).then((secret) => {
				                    this.info_logger.info('Sending secret ' + secret);
				                    //send cookie containing client secret!
				                    //TODO set up these options for cookie correctly
				                    //(https only, age, when it expires, possibly session stuff)
				                    res.cookie('act-url', act.ip + ":" + act.websock_port + "/")
                                    res.cookie('act-secret', secret);
                                    
				                    let secret_promises = [];
				                    for(let i = 0; i < act.webcams.length; i++){
				                        // 30 second secret TODO change to duration of timeslot.
				                        //Currently all webcams share a secret. Changing this should be easy, if needed.
				                        secret_promises.push(
				                            act.webcams[i].setSecret(secret, allow*1000).then(()=>{
				                                res.cookie("webcam-" + (i+1), (act.webcams[i].secure ? 'wss' : 'ws')+'://' + act.webcams[i].ip + ':' +  act.webcams[i].sock_port);
				                                res.cookie("webcam"+ (i+1) + "-secret", secret);
				                            })
				                        );
				                    }
				        
				                    Promise.all(secret_promises).then( ()=>{
				                        res.status(200).send(html_fetcher(__dirname + '/www/ControlPanel.html', req, {beforeHeader: ()=>{return '<title>Robot Remote - Control Panel</title>'}})); 
				                    }).catch(function(err){
				                        this.err_logger.error("Failed to connect to a camera server, " + err)
				                        res.status(500).send('Unable to communicate with webcam!');    
				                    }.bind(this));
				                    
				                })
				                .catch(function(err){
				                    this.err_logger.error("Failed to connect to actuator server, " + err)
				                    res.status(500).send(err);
				                }.bind(this));
				            })
				            .catch(function(err){
				                this.err_logger.error('Failed to get statuses???' + err);
				                res.status(500).send(err);
				            }.bind(this));
	                	}
	                	else{
	                		this.err_logger.info('Unable to find any time slots for user: ' + req.session.email);
								res.redirect(303, '/Scheduler.html');
	                	}
	            }.bind(this), function(err){
	            	  /* This may want to be classified as just 'info' as it's not really an error if the user
	                  * has no time slots.
                     * 
                     * Try warn instead? Not quite an error, but could be?
	                 */
	               this.err_logger.error(err);
                	this.err_logger.info('Unable to find any time slots for user: ' + req.session.email);
						res.redirect(303, '/Scheduler.html');
	            }.bind(this));
            }.bind(this), function(err){
                this.err_logger.error(err);
                this.err_logger.error('Unable to find user with email: ' + req.session.email);
                res.redirect(303, '/Scheduler.html');
            }.bind(this));
        }.bind(this));
        
        this._app.get('/Home.html', function(req, res){
            res.status(200).send(html_fetcher(__dirname + '/www/Home.html', req));
        }.bind(this));
        
        this._app.get('/Login.html', function(req, res){
            let opts = {};
            
            if(req.session.login_error){
                let err_str = req.session.login_error;
                opts.afterNavbar = ()=>('<input id="errmsg" type="hidden" value="' + err_str + '"/>');
                req.session.login_error = undefined;
            }
        
            res.status(200).send(html_fetcher(__dirname + '/www/Login.html', req, opts));
        }.bind(this));
        
        this._app.post('/Login.html', function(req, res){
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            if(req.session.email){
                res.status(200).send('Already logged in, log out first.');
                return;
            }

            if(!req.body.username || !req.body.password){
                res.status(200).send('Missing username or password');
                return;
            }
            
            user_auth.verify_credentials(req.body.username, req.body.password).then(function(info){
                var prev = req.body.prev;
                    
                req.session.loggedin = true;
                req.session.email = req.body.username;
                req.session.is_admin = info.is_admin;
                req.session.user_id = info.id;
                
                //check if page is in our domain
                if(prev !== undefined && (prev.startsWith('http://') || prev.startsWith('https://'))){		//is it in our domain
                    res.location(prev);
                }else{																	//else take them to the schedule page
                    res.location('/Scheduler.html');
                }
                
                res.status(302).send('Success');
            }.bind(this),function(err){
                this.err_logger.error(err);
                req.session.login_error = err.client_reason !== undefined ? err.client_reason : "Internal server error.";
                res.location('/Login.html');
                res.status(302).send('Failed to log in; ' + req.session.login_error);
            }.bind(this));
        }.bind(this));

        this._app.get('/Request.html', function(req, res){
            res.status(200).send(html_fetcher(__dirname + '/www/Request.html', req));
        }.bind(this));
        
        this._app.post('/Request.html', function(req, res){
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
            //These tests do exist in one of the client side js files
        
            user_auth.login_request(req.body.username, req.body.password, req.body.reason)
                .then(function(email_token){
                    res.status(200).send('success!');
                    let link = self._options['domain_name_secure'] + "/Verified.html?email=" + encodeURIComponent(req.body.username) + "&email_tok=" + encodeURIComponent(email_token);
                    
                    mail.mail(req.body.username, __dirname + '/Emails/confirm_email.txt', {link: link, name: req.body.username}).then(function(){
                        this.info_logger.info('Sent verification email to user!');
                    }.bind(this))
                    .catch(function(err){
                        this.err_logger.error('Failed to send verification email to user.');
                        this.err_logger.error(err);
                    }.bind(this));
                }.bind(this), function(err){
                    this.err_logger.error(err);
                    res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
                }.bind(this));
        }.bind(this));
        
        this._app.get('/Scheduler.html', function(req, res){
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            this.info_logger.info("Called scheduler");
            if(!req.session.loggedin){
                res.redirect(303, '/Login.html');
                return;
            }
            //TODO should be getting only up to now + max number of schedule days timeslot requests 
            db_fetch.user_get_timeslot_requests(new Date(), new Date(Date.now() + 7*24*60*60*1000), req.session.user_id)
            .then(function(requests){

                res.send(html_fetcher(__dirname + '/www/Scheduler.html', req, {
                    afterNavbar: ()=>`<input type='hidden' id='grid-data' value='${JSON.stringify(scheduler_generator.GenerateGrid(requests)
                        .reduce((acc, x) => acc.concat(x))).replace("'", '"')}'/>`
                }));
            }.bind(this))
            .catch(function(err){
                this.err_logger.error(err);
                res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
            }.bind(this));
        }.bind(this));

        this._app.get('/admin/Admin.html', function(req, res){
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
        }.bind(this));

    }

    //These return data in some form or another.
    registerAppAPIRoutes(){
        let self = this;
        /*Returns JSON encoded list of requests:
            {
                id:  <id for request>
                email: <email>,
                reason: <reason>
                date_requested: <datetime>
            }
        */
        this._app.get('/admin/loginrequests', function(req, res){
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            if(!req.session.loggedin){
                res.status(400).send('Not logged in.');
                return;
            }
            if(req.session.is_admin === undefined){
                res.status(403).send('Not an admin.');
                return;
            }

            if(!req.session.is_admin){
                res.status(403).send('Not an admin');
                return;
            }

            db_fetch.get_login_requests(0, -1).then(function(json){
                res.status(200).json({requests: json});
            }.bind(this), function(err){
                this.err_logger.error(err);
                res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
            }.bind(this));
        }.bind(this));

        this._app.get('/admin/currentusers', function(req, res){
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            if(!req.session.loggedin){
                res.status(400).send('Not logged in.');
                return;
            }
            if(req.session.is_admin === undefined){
                res.status(403).send('Not an admin.');
                return;
            }

            if(!req.session.is_admin){
                res.status(403).send('Not an admin.');
                return;
            }

            db_fetch.get_current_users(0, -1).then(function(json){
                res.status(200).json({requests: json});
            }.bind(this), function(err){
                this.err_logger.error(err);
                res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
            }.bind(this));
        }.bind(this));

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
        this._app.get('/admin/timeslotrequests', function(req, res){
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            if(!req.session.loggedin){
                res.status(400).send('Not logged in.');
                return;
            }
            if(req.session.is_admin === undefined){
                res.status(403).send('Not an admin.');
                return;
            }
            if(!req.session.is_admin){
                res.status(403).send('Not an admin.');
                return;
            }
            
            db_fetch.admin_get_timeslot_requests(new Date(Date.now()), new Date(Date.now() + 7*24*60*60*1000)).then(function(val){
                res.status(200).json(val);
            }.bind(this), function(err){
                this.err_logger.error(err);
                res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
            }.bind(this));

        }.bind(this));
        /* 
            Request to reject login request with given id
        */
        this._app.get('/admin/rejectloginrequest/:id', function(req, res){
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            
            if(req.params.id === undefined || Number(req.params.id) == NaN || Number(req.params.id) < 0 || Number(req.params.id) != Math.floor(Number(req.params.id))){
                res.status(400).send("Missing/malformed id");
                return;
            }

            if(!req.session.loggedin){
                res.status(403).send("Not logged in!");
                return;
            }
            if(req.session.is_admin === undefined){
                res.status(403).send("Not an admin!");
                return;
            }
            if(!req.session.is_admin){
                res.status(403).send("Not an admin!");
                return;
            }

            db_fetch.delete_user_by_request(req.params.id).then(async function(user_info){
                await mail.mail_to_user(user_info, __dirname + '/Emails/reject_user.txt', {name: user_info.email, email: this._options['mailer_email']});
                
                res.status(200).send("Success");
            
            }.bind(this))
            .catch(function(err){
                this.err_logger.error(err);
                res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
            }.bind(this));
        }.bind(this));
        /* 
            Request to reject login request with given id
        */
        this._app.get('/admin/removeuser/:id', function(req, res){
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            
            if(req.params.id === undefined || Number(req.params.id) == NaN){
                res.status(400).send("Missing/malformed id");
            }

            if(!req.session.loggedin){
                res.status(403).send("Not logged in!");
                return;
            }
            if(req.session.is_admin === undefined){
                res.status(403).send("Not an admin!");
                return;
            }
            if(!req.session.is_admin){
                res.status(403).send("Not an admin!");
                return;
            }

            db_fetch.delete_user_by_ID(req.params.id).then(function(user_id){
                //Do we want a account terminated email??? my guess is nah
                //mail.mail_to_user(user_id, __dirname + '/Emails/reject_user.txt', {});
                res.status(200).send("Success");
            }.bind(this))
            .catch(function(err){
                this.err_logger.error(err);
                res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
            }.bind(this));
        }.bind(this));

        /* 
            Power to give admin privilege 
        */
        this._app.get('/admin/adminify/:id', function(req, res){
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            
            if(req.params.id === undefined || Number(req.params.id) == NaN){
                res.status(400).send("Missing/malformed id");
            }

            if(!req.session.loggedin){
                res.status(403).send("Not logged in!");
                return;
            }
            if(req.session.is_admin === undefined){
                res.status(403).send("Not an admin!");
                return;
            }
            if(!req.session.is_admin){
                res.status(403).send("Not an admin!");
                return;
            }

            db_fetch.adminify(req.params.id).then(function(user_id){
                res.status(200).send("Success");
            }.bind(this))
            .catch(function(err){
                this.err_logger.error(err);
                res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
            }.bind(this));
        }.bind(this));

        /* 
            Power to give admin privilege 
        */
        this._app.get('/admin/deAdminify/:id', function(req, res){
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            
            if(req.params.id === undefined || Number(req.params.id) == NaN){
                res.status(400).send("Missing/malformed id");
            }

            if(!req.session.loggedin){
                res.status(403).send("Not logged in!");
                return;
            }
            if(req.session.is_admin === undefined){
                res.status(403).send("Not an admin!");
                return;
            }
            if(!req.session.is_admin){
                res.status(403).send("Not an admin!");
                return;
            }

            db_fetch.deAdminify(req.params.id).then(function(user_id){
                res.status(200).send("Success");
            }.bind(this))
            .catch(function(err){
                this.err_logger.error(err);
                res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
            }.bind(this));
        }.bind(this));

        /* 
            Request to accept login request with given id (for a loginrequest)
        */
        this._app.get('/admin/acceptloginrequest/:id', function(req, res){
            
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            
            if(req.params.id === undefined || Number(req.params.id) == NaN){
                res.status(400).send("Missing/malformed id");
            }

            if(!req.session.loggedin){
                res.status(403).send("Not logged in!");
                return;
            }
            if(req.session.is_admin === undefined){
                res.status(403).send("Not an admin!");
                return;
            }
            if(!req.session.is_admin){
                res.status(403).send("Not an admin!");
                return;
            }

            db_fetch.accept_user(req.params.id)
            .then(function(user_info){
                mail.mail_to_user(user_info.id, __dirname + '/Emails/accepted_user.txt', {name: user_info.email});
                res.status(200).send('Success!');
            }.bind(this))
            .catch(function(err){
                this.err_logger.error(err);
                res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
            }.bind(this));
        }.bind(this));
        /* 
            Request to reject timeslot request with given id
        */
        this._app.get('/admin/rejecttimeslotrequest/:id', function(req, res){
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            
            if(req.params.id === undefined || Number(req.params.id) == NaN){
                res.status(400).send("Missing/malformed id");
            }

            if(!req.session.loggedin){
                res.status(403).send("Not logged in!");
                return;
            }
            
            if(req.session.is_admin === undefined){
                res.status(403).send("Not an admin!");
                return;
            }

            if(!req.session.is_admin){
                res.status(403).send("Not an admin!");
                return;
            }

            db_fetch.delete_timeslotrequest_admin(req.params.id)
            .then(function(timeslot_info){
                mail.mail_to_user(timeslot_info.user_info.id , __dirname + '/Emails/reject_time.txt', {name: timeslot_info.user_info.email, 
                    email: this._options['mailer_email'], 
                    start_time: client_utils.DateTimeBeautify(timeslot_info.start_time), 
                    end_time: client_utils.DateTimeBeautify(timeslot_info.end_time)});
                
                res.status(200).send("Success");
            }.bind(this))
            .catch(function(err){
                this.err_logger.error(err);
                res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
            }.bind(this));

        }.bind(this));
        /* 
            Request to accept timeslot request with given id
        */
        this._app.get('/admin/accepttimeslotrequest/:id', function(req, res){
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            
            if(req.params.id === undefined || Number(req.params.id) == NaN){
                res.status(400).send("Missing/malformed id");
            }

            if(!req.session.loggedin){
                res.status(403).send("Not logged in!");
                return;
            }
            if(req.session.is_admin === undefined){
                res.status(403).send("Not an admin!");
                return;
            }
            if(!req.session.is_admin){
                res.status(403).send("Not an admin!");
                return;
            }

            db_fetch.accept_timeslot_request(req.params.id)
            .then(function(timeslot_info){
                mail.mail_to_user(timeslot_info.user_info, __dirname + '/Emails/accept_time.txt', {name: timeslot_info.user_info.email, 
                    start_time: client_utils.DateTimeBeautify(timeslot_info.start_time), 
                    end_time: client_utils.DateTimeBeautify(timeslot_info.end_time)});
                res.status(200).send("Success");
            }.bind(this)).catch(function(err){
                this.err_logger.error(err);
                res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
            }.bind(this));
        }.bind(this));

        /*Returns JSON encoded list of requests:
            {
                starttime: <datetime>,
                duration: <duration in seconds>
                accepted: <bool>
            }
        */
        this._app.get('/timeslotrequests', function(req, res){
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            if(!req.session.loggedin){
                //not logged in
                res.status(403).send('Not logged in!');
                return;
            }
            
            let now_ms = Date.now();
            let week_later_ms = now_ms + (24*60*60*1000)*7;

            db_fetch.user_get_timeslot_requests(new Date(now_ms), new Date(week_later_ms), req.session.user_id).then(function(json){
                res.status(200).json(json);
            }.bind(this),function(err){
                this.err_logger.error(err);
                res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
            }.bind(this));

        }.bind(this));
        /*
            Endpoint for timeslot request. Client needs to 
            provide start time in milliseconds since the unix epoch, and duration in milliseconds.
        */
        //These should match the ones in scheduler.js
        const time_quantum = 30;
        const max_quantums = 4;
        const num_days = 7;

        this._app.post('/requesttimeslot', function(req, res){
            
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
            //TODO make this check more robust (Only works if 60 % time_quantum = 0)
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

            db_fetch.add_request(date, (req.body.duration / 1000) - 1, req.session.user_id).then(function(val) {
                res.status(200).send("Success");

                let admin_link = self._options['domain_name_secure'] + "/admin/Admin.html"; 
                
                mail.mail_to_admins( __dirname +  '/Emails/admin_new_time.txt', {})
                .then(function(res){
                    this.info_logger.info("Sent mail to admin.");    
                }.bind(this), function(err){
                    this.err_logger.error('Failed to send mail to admin!' + err);
                }.bind(this));

            }.bind(this), function(err){
                this.err_logger.error(err);
                res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
            }.bind(this));

        }.bind(this));

        //This endpoint deletes the request with id,
        //only if the logged in user made it.
        this._app.get('/deletetimeslot/:id', function(req, res){
            
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");

            if(!req.session.loggedin){
                res.status(403).send("Not logged in!");
                return;
            }

            db_fetch.delete_request(req.params.id, req.session.user_id).then(function(){
                res.status(200).send('Success');
            }.bind(this),function(err){
                this.err_logger.error(err);
                res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
            }.bind(this));
        }.bind(this));

        this._app.get('/Logout', function(req, res){
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            req.session.loggedin = false;
            delete req.session;
            res.redirect(303, '/Home.html');
        }.bind(this));

        this._app.get('/Verified.html', function(req,res){
            res.append('Cache-Control', "no-cache, no-store, must-revalidate");
            
            user_auth.email_verify(req.query.email, req.query.email_tok).then(function(){
                let admin_link = this._options['domain_name_secure'] + "/admin/Admin.html";
                
                mail.mail_to_admins( __dirname + '/Emails/admin_new_user.txt', {}).then(function(){
                    this.info_logger.info('Sent email to admins!');
                }.bind(this))
                .catch(function(err){
                    this.err_logger.error('Failed to send email to admins');
                    this.err_logger.error(err);
                }.bind(this));
                
                res.status(200).send(html_fetcher(__dirname + '/www/Verified.html', req));
            }.bind(this),function(err){
                this.err_logger.error(err);
                res.status(500).send(err.client_reason !== undefined ? err.client_reason : "Internal server error.");
            }.bind(this));
        }.bind(this));


        //Resends verification email.
        this._app.post('/resendverification', function(req, res){
            if(req.body.username === undefined){
                req.session.login_error = 'Must provide a username.';
                res.redirect(302, '/Login.html');
                return;
            }

            if(req.body.password === undefined){
                req.session.login_error = 'Must provide a password.';
                res.redirect(302, '/Login.html');
                return;
            }

            user_auth.valid_user(req.body.username, req.body.password)
            .then(function(info){
                user_auth.needs_verification(info.id)
                .then(function(obj){
                    if(obj.needs_verif){
                        //resend verification email
                        let link = self._options['domain_name_secure'] + "/verify?email=" + encodeURIComponent(req.body.username) + "&email_tok=" + encodeURIComponent(obj.email_token);
                        return mail.mail(req.body.username, __dirname + '/Emails/new_confirmation.txt', {link: link, name: req.body.username})
                        .then(function(){
                            req.session.login_error = 'Verification email resent.';
                            res.redirect(302, '/Login.html');
                        }.bind(this))
                        .catch(function(err){
                            this.err_logger.error('Encountered an error: ');
                            this.err_logger.error(err);
                            req.session.login_error = err.client_reason !== undefined ? err.client_reason : "Internal server error.";
                            res.redirect(302, '/Login.html');
                        }.bind(this));
                    }else{
                        req.session.login_error = 'Your email is already verified!';
                        res.redirect(302, '/Login.html');
                    }
                }.bind(this))
                .catch(function(err){
                    this.err_logger.error('Encountered an error: ');
                    this.err_logger.error(err);
                    req.session.login_error = err.client_reason !== undefined ? err.client_reason : "Internal server error.";
                    res.redirect(302, '/Login.html');
                }.bind(this));  
            }.bind(this))
            .catch(function(err){
                this.err_logger.error('Encountered an error: ');
                this.err_logger.error(err);
                req.session.login_error = err.client_reason !== undefined ? err.client_reason : "Internal server error.";
                res.redirect(302, '/Login.html');
            }.bind(this));
        }.bind(this));
    
        /**********************************************************************/
        this._app.post('/sendpassreset', function(req,res){
        		res.append('Cache-Control', "no-cache, no-store, must-revalidate");
        		if(!req.body.password){
        			res.status(400).send('Missing new password!');
        			return;
        		}
        		
        		user_auth.update_password(/*Email Somehow*/req.body.password)
        			.then(function(){
        				res.status(200).send('Success!');
        			})
        }.bind(this));
        
        /***********************************************************************/
    
    }

    registerApp404Route(){
        /* 404 page. Can support other errors, technically, but currently is not used for anything else.*/
        this._app.all('*', function(req, res){
            let opts = { };
            
            if(req.session.error_status === undefined){
                req.session.error_status = 404;
            }
            
            let err_str = req.session.error_str ? req.session.error_str : 'Page Not Found';
            
            opts.afterNavbar = ()=>('<input id="errmsg" type="hidden" value="' + err_str + '"/>');
        
            res.status(req.session.error_status).send(html_fetcher(__dirname + '/www/Error.html', req, opts));
            req.session.error_status = undefined;
        }.bind(this));
    }

    createServers(){
        let credentials = {
            key: this._server_key,
            cert: this._server_cert
        };

        this._http_server = http.createServer(this._app);
        this._https_server = https.createServer(credentials, this._app);
    }

    listen(){
        this._http_server.listen(this._options['http_port']);
        this._https_server.listen(this._options['https_port']);
    }

    //Returns a promise, resolving when the server is succesfully closed down.
    end(){
        return new Promise(function(resolve, reject){
            let num_closes = 3;
            
            function closeCallback(){
                num_closes--;
                if(num_closes == 0){
                    resolve();
                }
            }

            this._http_server.close(closeCallback);
            this._https_server.close(closeCallback);
            log4js.shutdown(closeCallback);
            db_fetch.deinit_mysql();
            this._mysql_pool.end();
            this._session_store.close();
        }.bind(this));
    }
    //Getters (and setters, if there ever are any)
    get options(){
        return this._options;
    }

    get client_cert(){
        return this._client_cert;
    }

    get client_key(){
        return this._client_key;
    }

    get ca_cert(){
        return this._cacert;
    }
}

if(!module.parent){
    const options = require('./settings.json');
    let server = new RobotRemoteServer(options);
    server.initApp();
    server.registerAppRoutes();
    server.registerAppAPIRoutes();
    server.registerApp404Route();
    server.createServers();
    server.listen();

    server.info_logger.info('Server listening on http://localhost:' + options['http_port'] + 
    ' and https://localhost:' + options['https_port']);

    //SIGUSR2 must be used. SIGUSR1 is reserved for node.
    //This tells the parent process that the server is started.
    //The passed in (optional) argument is the pid to signal.
    if(process.argv.length === 3){
        process.kill(parseInt(process.argv[2]), 'SIGUSR2');
    }
}

module.exports.RobotRemoteServer = RobotRemoteServer;
