const mysql = require('mysql2/promise');
const crypto = require('crypto');

class SeedLoginRequest {
    constructor(email_token, email_validated, comment, date_requested){
        this.email_token = email_token;
        this.email_validated = email_validated;
        this.comment = comment;
        this.date_requested = new Date(Math.round(date_requested/1000)*1000);
    }

    async insert(pool){
        let sql = 'INSERT INTO loginrequests (email_token, email_validated, comment, date_requested) VALUES' + 
        ' (?, ?, ?, ?)';
        let conn = await pool.getConnection();
        try{
            await conn.query(sql, [this.email_token, this.email_validated, this.comment, this.date_requested]);
            let [res, fields] = await conn.query('SELECT LAST_INSERT_ID()');
            this.id = res[0]['LAST_INSERT_ID()'];
        }finally{
            conn.release();
        }
    }
}

class SeedUser {
    constructor(email, password, approved, admin, loginreq){
        this.email = email;
        this.password = password;
        this.approved = approved;
        this.admin = admin;
        this.loginreq = loginreq;    
    }

    get passhash(){
        if(!this._passhash){
            this._passhash = crypto.createHash('sha256').update(this.password + this.passsalt).digest('hex');
        }
        return this._passhash;
    }

    get passsalt(){
        if(!this._passsalt){
            this._passsalt = crypto.randomBytes(32).toString('hex');
        }
        return this._passsalt;
    }

    get loginreq_id(){
        if(this.loginreq && this.loginreq.id){
            return this.loginreq.id;
        }
        return null;
    }

    async insert(pool){
        let sql = 'INSERT INTO users (email, passhash, passsalt, approved, admin, loginreq_id) VALUES' + 
        ' (?, ?, ?, ?, ?, ?)';
        let conn = await pool.getConnection();
        try{
            await conn.query(sql, [this.email, this.passhash, this.passsalt, this.approved, this.admin, this.loginreq_id]);
            
            let [res, fields] = await conn.query('SELECT LAST_INSERT_ID()');
            this.id = res[0]['LAST_INSERT_ID()'];
        }finally{
            conn.release();
        }
    }
}

class SeedTimeslot {
    constructor(user, start, duration, approved, act_num){
        this.user = user;
        this.start_time = new Date(Math.round(start.getTime()/1000)*1000);
        this.duration = duration;
        this.approved = approved;
        this.act_num = act_num;
    }

    async insert(pool){
        let sql = 'INSERT INTO timeslots (user_id, start_time, duration, approved, act_num) VALUES' + 
        ' (?, ?, ?, ?, ?)';
        let conn = await pool.getConnection();
        try{
            await conn.query(sql, [this.user.id, this.start_time, this.duration, this.approved, this.act_num]);

            let [res, fields] = await conn.query('SELECT LAST_INSERT_ID()', []);
            this.id = res[0]['LAST_INSERT_ID()'];
        }finally{
            conn.release();
        }
    }
}

const SEED_LOGINREQUESTS = [
    new SeedLoginRequest('tok1', 0, 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum', new Date()),
    new SeedLoginRequest('tok2', 1, 'I am a user', new Date(Date.now() - 24*60*60*1000))
]

const SEED_USERS = [
    new SeedUser('email@email.com', 'password1', 0, 0, SEED_LOGINREQUESTS[0]),
    new SeedUser('email2@xyz.com', 'password2', 0, 0, SEED_LOGINREQUESTS[1]),
    new SeedUser('email3@xyz.com', 'password3', 1, 0, null),
    new SeedUser('email4@xyz.com', 'password4', 1, 0, null),
    new SeedUser('admin@xyz.com', 'password5', 1, 1, null),
    new SeedUser('admin2@xyz.com', 'password6', 1, 1, null)
]

const SEED_TIMESLOTS = [
    new SeedTimeslot(SEED_USERS[2], new Date(Date.now() + 3*24*60*60*1000), 4*60*60, 0, 0),
    new SeedTimeslot(SEED_USERS[3], new Date(Date.now() + 3*24*60*60*1000), 3*60*60, 0, 1),
    new SeedTimeslot(SEED_USERS[3], new Date(Date.now() + 2*12*60*60*1000), 4*60*60, 1, 0),
    new SeedTimeslot(SEED_USERS[2], new Date(Date.now() + 3*12*60*60*1000), 2*60*60, 1, 1),
]

//NOTE: COMPLETELY OBLITERATES THE DB. DON'T DO THIS IF YOU LIKE YOUR DB.
async function deleteAllRecords(pool){
    await pool.query('DELETE FROM loginrequests WHERE 1=1');
    await pool.query('DELETE FROM users WHERE 1=1');
    await pool.query('DELETE FROM timeslots WHERE 1=1');
}

async function seedDB(pool){
    let promises = [];
    let promise = null;

    for(let login_req of SEED_LOGINREQUESTS){
        promises.push(login_req.insert(pool));
    }

    promise = Promise.all(promises);
    await promise;

    //I tried doing these inserts concurrently; It deadlocks way too often.
    //Looking into it, it has something to do with unique keys, and things called 'gap locks'.
    //There are other ways to resolve these locks, such as using transactions in specific ways,
    //or probably a table lock, or ordering the insertions. They all cut into concurrency too.
    //we'll just insert them sequentially instead.
    for(let user of SEED_USERS){
        await user.insert(pool);
    }

    promises = [];

    for(let timeslot of SEED_TIMESLOTS){
        promises.push(timeslot.insert(pool));
    }

    promise = Promise.all(promises);
    await promise;
}

module.exports.deleteAllRecords = deleteAllRecords;
module.exports.seedDB = seedDB;
module.exports.SEED_LOGINREQUESTS = SEED_LOGINREQUESTS;
module.exports.SEED_USERS = SEED_USERS;
module.exports.SEED_TIMESLOTS = SEED_TIMESLOTS;
