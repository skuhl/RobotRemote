const wtf = require('wtfnode');
const assert = require('assert');
const { RobotRemoteServer } = require('../node/index.js');
const seed = require('./seed_db.js');
const db_setup = require('../helperscripts/db_setup.js');
const test_utils = require('./test_utils.js');
const mysql = require('mysql2/promise');

const webserver_test_options = require('../node/settings.json');

const TEST_DB_NAME = 'RobotRemoteTest';
const SLOW_HTTP_MS = 300;

const log4js = require('log4js');

let pool;
let server;

describe('Tests', function(){
    //Most tests take ~100 ms, that's just the price of an http request.
    //Some take up to 200 ms.
    //More than 300 ms is what we'll consider 'slow'.
    this.slow(SLOW_HTTP_MS);

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
        //Q: err?
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
            await server.end();
            server = null;
        });
        
        describe('login', function(){
            it('Fails to login a non-existant user', async function(){
                await assert.rejects(test_utils.login({email: 'notarealuser@mtu.edu', password:'notarealpassword'}, 
                server._cacert), 
                Error, 
                new Error('Logging in with an invalid username failed to reject'));
            });

            it('Fails to login a user with an incorrect password', async function(){
                await assert.rejects(test_utils.login({email: seed.SEED_USERS.find(x => x.approved == 1).email, password:'notarealpassword'}, 
                server._cacert), 
                Error, 
                new Error('Logging in with an invalid password failed to reject'));
            });
            
            it('Fails to login a user who is not approved yet', async function(){
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

            it('Fails to login without a proper email provided', async function(){
                await assert.rejects(test_utils.login({password: 'password1'}, 
                server._cacert), 
                Error, 
                new Error('Logging in with an invalid username failed to reject'));
            });

            it('Fails to login without a proper password provided', async function(){
                await assert.rejects(test_utils.login({email: seed.SEED_USERS.find(x => x.approved == 1).email}, 
                server._cacert), 
                Error, 
                new Error('Logging in with an invalid username failed to reject'));
            });

        });

        describe('/admin/loginrequests', function(){
            it('Rejects non-admin requests', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 0), server._cacert);
                
                let ret = await assert.rejects(test_utils.attemptRequest('/admin/loginrequests', 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a non-admin request!'));
            });

            it('Rejects a request when not logged in.', async function(){
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
                        x => !(x.id == req.id &&
                        x.comment == req.reason &&
                        x.date_requested.getTime() == new Date(req.date_requested).getTime()));
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
                        x => !(x.id == user.id &&
                        x.admin == user.admin &&
                        x.email == user.email));
                    //Assert that one and only one element was removed/filtered out.
                    assert(new_db.length === seed_db.length - 1, new Error(`Could not find request with id ${user.id}`));
                    seed_db = new_db;
                }

                assert(seed_db.length === 0, new Error('Did not get all users in DB!'));

            });
        });

        describe('/admin/timeslotrequests', function(){
            it('Rejects non-admin requests', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 0), server._cacert);
                
                await assert.rejects(test_utils.attemptRequest('/admin/timeslotrequests', 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a non-admin request!'));

            });

            it('Rejects a request when not logged in', async function(){
                //No cookie given; as if there is no session.
                await assert.rejects(test_utils.attemptRequest('/admin/timeslotrequests', 'GET', 3001, undefined, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request when not logged in!'));
            });

            it('Accepts an admin request', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                let res = await test_utils.attemptRequest('/admin/timeslotrequests', 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);
            });

            it('Returns acceptable and correct json-encoded data', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                let res = await test_utils.attemptRequest('/admin/timeslotrequests', 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);

                let json = JSON.parse(res.data);
                let requests = json.approved.concat(json.unapproved);

                assert(typeof requests === 'object' && requests instanceof Array);

                //Assure that the requests are actually in the seed db.
                let seed_db = seed.SEED_TIMESLOTS.slice();

                for(let req of requests){
                    let new_db = seed_db.filter(
                        x => !(x.id == req.id &&
                        x.duration  == req.duration &&
                        x.start_time.getTime() == new Date(req.starttime).getTime() &&
                        x.user.email == req.email));
                        //Assert that one and only one element was removed/filtered out.
                    assert(new_db.length === seed_db.length - 1, new Error(`Could not find request with id ${req.id}`));
                    seed_db = new_db;
                }

                assert(seed_db.length === 0, new Error('Did not get all requests in DB!'));

            });
        });

        describe('/admin/rejectloginrequest/:id', function(){
            afterEach(async function(){
                //We reseed the DB. This is done
                //because this endpoint effects the database.
                await seed.deleteAllRecords(pool);
                await seed.seedDB(pool);
            });

            it('Rejects non-admin requests', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 0), server._cacert);
                
                await assert.rejects(test_utils.attemptRequest(`/admin/rejectloginrequest/${seed.SEED_USERS.find( x => x.approved == 0).loginreq_id}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a non-admin request!'));

            });

            it('Rejects a request when not logged in', async function(){
                //No cookie given; as if there is no session.
                await assert.rejects(test_utils.attemptRequest(`/admin/rejectloginrequest/${seed.SEED_USERS.find( x => x.approved == 0).loginreq_id}`, 'GET', 3001, undefined, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request when not logged in!'));
            });

            it('Rejects a request with a negative id', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                await assert.rejects(test_utils.attemptRequest(`/admin/rejectloginrequest/-1`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request with a negative id!'));
            });

            it('Rejects a request with a non-numeric id', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                await assert.rejects(test_utils.attemptRequest(`/admin/rejectloginrequest/notanumber`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request with a non-numeric id!'));
            });

            it('Rejects a request with an incorrect id', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                //we choose an ID which is the sum of all seeded ids. This is guarenteed to not be a current user it.
                await assert.rejects(test_utils.attemptRequest(`/admin/rejectloginrequest/${seed.SEED_USERS.reduce((acc, x) => typeof acc != 'number' ? acc.id + x.id : acc + x.id)}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request with an invalid id!'));
            });

            it('Accepts an admin request', async function(){
                this.timeout(5000);
                this.slow(2500);
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                let res = await test_utils.attemptRequest(`/admin/rejectloginrequest/${seed.SEED_USERS.find( x => x.approved == 0).loginreq_id}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);
            });

            it('Successfully removes request when called', async function(){
                this.timeout(5000);
                //Request needs to send an email, so it takes a while
                this.slow(3000);
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                let removed_user = seed.SEED_USERS.find( x => x.approved == 0);

                await test_utils.attemptRequest(`/admin/rejectloginrequest/${removed_user.loginreq_id}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);

                let res = await test_utils.attemptRequest('/admin/loginrequests', 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);

                let requests_remaining = JSON.parse(res.data).requests;

                assert(requests_remaining.find(x => x.id == removed_user.loginreq_id) === undefined);
            });
            
            it('Successfully removes user when called', async function(){
                this.timeout(5000);
                //Request needs to send an email, so it takes a while
                this.slow(3000);
                
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                let removed_user = seed.SEED_USERS.find( x => x.approved == 0);

                await test_utils.attemptRequest(`/admin/rejectloginrequest/${removed_user.loginreq_id}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);

                let res = await test_utils.attemptRequest('/admin/currentusers', 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);

                let users_remaining = JSON.parse(res.data).requests;

                assert(users_remaining.find(x => x.id == removed_user.id) === undefined);
            });

        });

        describe('/admin/removeuser/:id', function(){
            afterEach(async function(){
                //We reseed the DB. This is done
                //because this endpoint effects the database.
                await seed.deleteAllRecords(pool);
                await seed.seedDB(pool);
            });

            it('Rejects non-admin requests', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 0), server._cacert);
                
                await assert.rejects(test_utils.attemptRequest(`/admin/removeuser/${seed.SEED_USERS.find( x => x.approved == 0).id}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a non-admin request!'));

            });

            it('Rejects a request when not logged in', async function(){
                //No cookie given; as if there is no session.
                await assert.rejects(test_utils.attemptRequest(`/admin/removeuser/${seed.SEED_USERS.find( x => x.approved == 0).id}`, 'GET', 3001, undefined, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request when not logged in!'));
            });

            it('Rejects a request with a negative id', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                await assert.rejects(test_utils.attemptRequest(`/admin/removeuser/-1`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request with a negative id!'));
            });

            it('Rejects a request with a non-numeric id', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                await assert.rejects(test_utils.attemptRequest(`/admin/removeuser/notanumber`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request with a non-numeric id!'));
            });

            it('Rejects a request with an incorrect id', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                //we choose an ID which is the sum of all seeded ids. This is guaranteed to not be a current user.
                await assert.rejects(test_utils.attemptRequest(`/admin/removeuser/${seed.SEED_USERS.reduce((acc, x) => typeof acc != 'number' ? acc.id + x.id : acc + x.id)}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request with an invalid id!'));
            });

            it('Accepts an admin request', async function(){
                this.timeout(5000);
                this.slow(2500);
                let admin = seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1);
                let sid = await test_utils.login(admin, server._cacert);
                let res = await test_utils.attemptRequest(`/admin/removeuser/${seed.SEED_USERS.find( x => x.approved == 1 && x.id != admin.id).id}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);
            });

            it('Correctly removes the user', async function(){
                this.timeout(5000);
                //Request needs to send an email, so it takes a while
                this.slow(3000);

                let admin = seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1);
                let sid = await test_utils.login(admin, server._cacert);
                
                let removed_user = seed.SEED_USERS.find( x => x.approved == 0 && x.id != admin.id);

                await test_utils.attemptRequest(`/admin/removeuser/${removed_user.id}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);

                let res = await test_utils.attemptRequest('/admin/currentusers', 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);

                let users_remaining = JSON.parse(res.data).requests;

                assert(users_remaining.find(x => x.id == removed_user.id) === undefined);
            });
        });

        describe('/admin/adminify/:id', function(){
            afterEach(async function(){
                //We reseed the DB. This is done
                //because this endpoint effects the database.
                await seed.deleteAllRecords(pool);
                await seed.seedDB(pool);
            });

            it('Rejects non-admin requests', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 0), server._cacert);
                
                await assert.rejects(test_utils.attemptRequest(`/admin/adminify/${seed.SEED_USERS.find( x => x.approved == 0).id}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a non-admin request!'));

            });

            it('Rejects a request when not logged in', async function(){
                //No cookie given; as if there is no session.
                await assert.rejects(test_utils.attemptRequest(`/admin/adminify/${seed.SEED_USERS.find( x => x.approved == 0).id}`, 'GET', 3001, undefined, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request when not logged in!'));
            });

            it('Rejects a request with a negative id', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                await assert.rejects(test_utils.attemptRequest(`/admin/adminify/-1`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request with a negative id!'));
            });

            it('Rejects a request with a non-numeric id', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                await assert.rejects(test_utils.attemptRequest(`/admin/adminify/notanumber`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request with a non-numeric id!'));
            });

            it('Rejects a request with an incorrect id', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                //we choose an ID which is the sum of all seeded ids. This is guaranteed to not be a current user.
                await assert.rejects(test_utils.attemptRequest(`/admin/adminify/${seed.SEED_USERS.reduce((acc, x) => typeof acc != 'number' ? acc.id + x.id : acc + x.id)}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request with an invalid id!'));
            });

            it('Accepts an admin request', async function(){
                this.timeout(5000);
                this.slow(2500);
                let admin = seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1);
                let sid = await test_utils.login(admin, server._cacert);
                let res = await test_utils.attemptRequest(`/admin/adminify/${seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 0 && x.id != admin.id).id}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);
            });

            it('Correctly adminifies the user', async function(){
                this.timeout(5000);
                this.slow(2500);
                let admin = seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1);
                let sid = await test_utils.login(admin, server._cacert);

                let user = seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 0 && x.id != admin.id);

                await test_utils.attemptRequest(`/admin/adminify/${user.id}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);

                let res = await test_utils.attemptRequest('/admin/currentusers', 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);

                let users = JSON.parse(res.data).requests;
                
                assert(users.find(x => x.id == user.id).admin === 1);
            });
        });

        describe('/admin/deAdminify/:id', function(){
            afterEach(async function(){
                //We reseed the DB. This is done
                //because this endpoint effects the database.
                await seed.deleteAllRecords(pool);
                await seed.seedDB(pool);
            });

            it('Rejects non-admin requests', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 0), server._cacert);
                
                await assert.rejects(test_utils.attemptRequest(`/admin/deAdminify/${seed.SEED_USERS.find( x => x.approved == 0).id}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a non-admin request!'));

            });

            it('Rejects a request when not logged in', async function(){
                //No cookie given; as if there is no session.
                await assert.rejects(test_utils.attemptRequest(`/admin/deAdminify/${seed.SEED_USERS.find( x => x.approved == 0).id}`, 'GET', 3001, undefined, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request when not logged in!'));
            });

            it('Rejects a request with a negative id', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                await assert.rejects(test_utils.attemptRequest(`/admin/deAdminify/-1`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request with a negative id!'));
            });

            it('Rejects a request with a non-numeric id', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                
                await assert.rejects(test_utils.attemptRequest(`/admin/deAdminify/notanumber`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request with a non-numeric id!'));
            });

            it('Rejects a request with an incorrect id', async function(){
                let sid = await test_utils.login(seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1), server._cacert);
                //we choose an ID which is the sum of all seeded ids. This is guaranteed to not be a current user.
                await assert.rejects(test_utils.attemptRequest(`/admin/deAdminify/${seed.SEED_USERS.reduce((acc, x) => typeof acc != 'number' ? acc.id + x.id : acc + x.id)}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert),
                Error,
                new Error('Accepted a request with an invalid id!'));
            });

            it('Accepts an admin request', async function(){
                this.timeout(5000);
                this.slow(2500);
                let admin = seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1);
                let sid = await test_utils.login(admin, server._cacert);
                let res = await test_utils.attemptRequest(`/admin/deAdminify/${seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 0 && x.id != admin.id).id}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);
            });

            it('Correctly deadminifies the user', async function(){
                this.timeout(5000);
                this.slow(2500);
                let admin = seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1);
                let sid = await test_utils.login(admin, server._cacert);

                let user = seed.SEED_USERS.find( x => x.approved == 1 && x.admin == 1 && x.id != admin.id);

                await test_utils.attemptRequest(`/admin/deAdminify/${user.id}`, 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);

                let res = await test_utils.attemptRequest('/admin/currentusers', 'GET', 3001, {cookie: `connect.sid=${encodeURIComponent(sid)}`}, undefined, undefined,
                undefined, server._cacert);

                let users = JSON.parse(res.data).requests;
                
                assert(users.find(x => x.id == user.id).admin === 0);
            });
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
