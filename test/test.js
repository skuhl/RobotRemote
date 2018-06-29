const wtf = require('wtfnode');
const assert = require('assert');
const { RobotRemoteServer } = require('../node/index.js');
const seed = require('./seed_db.js');
const db_setup = require('../helperscripts/db_setup.js');
const test_utils = require('./test_utils.js');
const mysql = require('mysql2/promise');

const webserver_test_options = require('../node/settings.json');

const TEST_DB_NAME = 'RobotRemoteTest';

let pool;
let server;

describe('Tests', function(){
    before(function(){
        pool = mysql.createPool({
            connectionLimit: 10,
            host: webserver_test_options['mysql_host'],
            port: webserver_test_options['mysql_port'],
            user:  webserver_test_options['mysql_user'],
            password: webserver_test_options['mysql_pass'],
            database: TEST_DB_NAME,
            /*This code snippet found from  https://www.bennadel.com/blog/3188-casting-bit-fields-to-booleans-using-the-node-js-mysql-driver.htm*/
            typeCast: function( field, useDefaultTypeCasting ) {
                if (field.type === "BIT" && field.length === 1) {
                    let bytes = field.buffer();
                    return bytes[0] === 1;
                }
        
                return useDefaultTypeCasting();
            }
        });
    });

    after(function(){
        pool.end();
        console.log('Dumping possible open connections: (diagnose these if mocha stays open)');
        wtf.dump();
    });

    //Tests webserver endpoints
    describe('Webserver API', function(){
        before(async function(){
            this.timeout(0);

            let db_creds = await test_utils.getDBPasswords();
            await db_setup.setupDB(webserver_test_options['mysql_host'], 
                webserver_test_options['mysql_port'], 'localhost',
                db_creds.admin_user, db_creds.admin_pass, webserver_test_options['mysql_pass'],
                TEST_DB_NAME 
            );

            webserver_test_options.mysql_db = TEST_DB_NAME;
            //Lets seed the DB
            await seed.deleteAllRecords(pool);
            await seed.seedDB(pool);

            server = new RobotRemoteServer(webserver_test_options);
            server.initApp();
            server.registerAppRoutes();
            server.registerAppAPIRoutes();
            server.registerApp404Route();
            server.createServers();
            server.listen();
        });

        after(async function(){
            console.log('Ending server');
            await server.end();
            server = null;
        });
        
        describe('login', function(){
            it('fails to login a non-existant user', async function(){
                await assert.rejects(test_utils.login({email: 'notarealuser@mtu.edu', password:'notarealpassword'}, 
                server._cacert), 
                Error, 
                new Error('Logging in with an invalid username failed to reject'));
            });

            it('fails to login a user with an incorrect password', async function(){
                await assert.rejects(test_utils.login({email: seed.SEED_USERS.find(x => x.approved == 1).email, password:'notarealpassword'}, 
                server._cacert), 
                Error, 
                new Error('Logging in with an invalid password failed to reject'));
            });
            
            it('fails to login a user who is not approved yet', async function(){
                await assert.rejects(test_utils.login(seed.SEED_USERS.find(x => x.approved == 0), 
                server._cacert), 
                Error, 
                new Error('Logging in with an unapproved user failed to reject'));
            });

            it('Properly logs in a normal, approved user', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find(x => x.approved == 1 && x.admin == 0), server._cacert);
                assert(typeof sid === 'string');
            });

            it('Properly logs in an approved admin user', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find(x => x.approved == 1 && x.admin == 1), server._cacert);
                assert(typeof sid === 'string');
            });

            it('fails to login without a proper email provided', async function(){
                await assert.rejects(test_utils.login({password: 'password1'}, 
                server._cacert), 
                Error, 
                new Error('Logging in with an invalid username failed to reject'));
            });

            it('fails to login without a proper password provided', async function(){
                await assert.rejects(test_utils.login({email: seed.SEED_USERS.find(x => x.approved == 1).email}, 
                server._cacert), 
                Error, 
                new Error('Logging in with an invalid username failed to reject'));
            });

        });

        describe('/admin/loginrequests', function(){
            it('rejects non-admin requests', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 0), server._cacert);
                
                let ret = await assert.rejects(test_utils.attemptRequest('/admin/loginrequests', 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a non-admin request!'));
            });

            it('rejects a request when not logged in.', async function(){
                //No cookie given; as if there is no session.
                await assert.rejects(test_utils.attemptRequest('/admin/loginrequests', 'GET', 3001, undefined, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request when not logged in!'));
            });

            it('Accepts an admin request', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                let res = await test_utils.attemptRequest('/admin/loginrequests', 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);
            });

            it('Returns acceptable and correct json-encoded data', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                let res = await test_utils.attemptRequest('/admin/loginrequests', 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);

                let requests = JSON.parse(res.data).requests;

                assert(typeof requests === 'object' && requests instanceof Array);

                //Assure that the requests are actually in the seed db.
                let seed_db = seed.SEED_LOGINREQUESTS.slice().filter(x => x.email_validated == 1);
                for(let req of requests){
                    //Remove the one in this iteration from the array
                    let new_db = seed_db.filter(
                        x => x.id != req.id &&
                        x.comment != req.reason &&
                        x.date_requested != req.date_requested);
                    //Assert that one and only one element was removed/filtered out.
                    assert(new_db.length === seed_db.length - 1, new Error(`Could not find request with id ${req.id}`));
                    seed_db = new_db;
                }

                assert(seed_db.length === 0, new Error('Did not get all requests in DB!'));

            });
        });

        describe('/admin/currentusers', function(){
            it('Rejects non-admin requests', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 0), server._cacert);
                
                await assert.rejects(test_utils.attemptRequest('/admin/currentusers', 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a non-admin request!'));

            });

            it('Rejects a request when not logged in', async function(){
                //No cookie given; as if there is no session.
                await assert.rejects(test_utils.attemptRequest('/admin/currentusers', 'GET', 3001, undefined, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request when not logged in!'));
            });

            it('Accepts an admin request', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                let res = await test_utils.attemptRequest('/admin/currentusers', 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);
            });

            it('Returns acceptable and correct json-encoded data', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                let res = await test_utils.attemptRequest('/admin/currentusers', 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);

                let users = JSON.parse(res.data).requests;

                assert(typeof users === 'object' && users instanceof Array);

                //Assure that the requests are actually in the seed db.
                let seed_db = seed.SEED_USERS.slice().filter(x => x.approved);
                for(let user of users){
                    let new_db = seed_db.filter(
                        x => x.id != user.id &&
                        x.admin != user.admin &&
                        x.email != user.email);
                    //Assert that one and only one element was removed/filtered out.
                    assert(new_db.length === seed_db.length - 1, new Error(`Could not find request with id ${user.id}`));
                    seed_db = new_db;
                }

                assert(seed_db.length === 0, new Error('Did not get all users in DB!'));

            });
        });

        describe('/admin/timeslotrequests', function(){
            
        });

        describe('/admin/rejectloginrequest/:id', function(){
            
        });

        describe('/admin/removeuser/:id', function(){
            
        });

        describe('/admin/adminify/:id', function(){
            
        });

        describe('/admin/deAdminify/:id', function(){
            
        });

        describe('/admin/acceptloginrequest/:id', function(){
            
        });

        describe('/admin/rejecttimeslotrequest/:id', function(){
            
        });

        describe('/admin/accepttimeslotrequest/:id', function(){
            
        });

        describe('/timeslotrequests', function(){
            
        });

        describe('/requesttimeslot', function(){
            
        });

        describe('/deletetimeslot/:id', function(){
            
        });

        describe('/Logout', function(){
            
        });

        describe('/verify', function(){
            
        });
    });

    //Tests camera endpoints
    describe('Camera API', function(){

    });

    //Tests armserver endpoints
    describe('Arm Server API', function(){

    });

    //Tests webserver rendering of pages
    describe('Webserver Rendering', function(){

    });

    //Test communication between webserver and actuator
    //Using the code in actuator_comm.js
    describe('Webserver Actuator Communication', function(){

    });

    //Test communication between webserver and camera server
    //Using the code in webcam_comm.js
    describe('Webserver Camera Communication', function(){

    });

    //Test Camera Websockets
    describe('Camera Websockets', function(){

    });

    //Test Arm Websockets
    describe('Arm Websockets', function(){
        
    });
});
