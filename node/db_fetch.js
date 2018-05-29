const mysql = require('mysql');

let connection = null;

module.exports = {
    init_mysql: function(host, username, password, database){
        connection = mysql.createConnection({
            host: host,
            user: username,
            password: password,
            database: database,
            /*This code snippet found from  https://www.bennadel.com/blog/3188-casting-bit-fields-to-booleans-using-the-node-js-mysql-driver.htm*/
            typeCast: function castField( field, useDefaultTypeCasting ) {
                if (field.type === "BIT" && field.length === 1) {
                    let bytes = field.buffer();
                    return bytes[0] === 1;
        
                }

                return useDefaultTypeCasting();
        
            }
        });
    },
    /* if num_requests <= 0, we get all requests. */
    get_login_requests: async function(start_at, num_requests){
        let json = [];
        return new Promise((resolve, reject) => {
            if(num_requests <= 0 ){
                connection.query('SELECT loginrequests.id, users.email, loginrequests.comment FROM users INNER JOIN loginrequests ON users.loginreq_id = loginrequests.id WHERE email_validated=1', [], function(err, res, fields){    
                    if(err){
                        return reject({
                            reason: 'Error selecting from loginrequests.',
                            client_reason: 'Internal database error.',
                            db_err: err
                        });
                    }
                    //Is this necessary? Could we just do json = res? 
                    for(let i = 0; i<res.length; i++){
                        json.push({
                            id: res[i].id,
                            email: res[i].email,
                            reason: res[i].comment
                        });
                    }
                    resolve(json);
    
                });
            }else{
                connection.query('SELECT loginrequests.id, users.email, loginrequests.comment FROM users INNER JOIN loginrequests ON users.loginreq_id = loginrequests.id WHERE email_validated=1 LIMIT ? OFFSET ?', [num_requests, start_at], function(err, res, fields){    
                    if(err){
                        return reject({
                            reason: 'Error selecting from loginrequests.',
                            client_reason: 'Internal database error.',
                            db_err: err
                        });
                    }
                    //Is this necessary? Could we just do json = res? 
                    for(let i = 0; i<res.length; i++){
                        json.push({
                            id: res[i].id,
                            email: res[i].email,
                            reason: res[i].comment
                        });
                    }
                    resolve(json);
    
                });
            }
        });
    },
    /*Timeframe */
    user_get_timeslot_requests: async function(beginDate, endDate, email){
        return new Promise((resolve, reject) => {
            connection.query('SELECT users.email, timeslots.start_time, timeslots.duration, timeslots.approved FROM users INNER JOIN timeslots ON users.id = timeslots.user_id WHERE start_time > ? AND start_time < ?', [beginDate, endDate], function(err, res, fields){
                let mine = [];
                let others = [];
                if(err){
                    return reject({
                        reason: 'Error selecting from timeslots.',
                        client_reason: 'Internal database error.',
                        db_err: err
                    });
                }

                for(let i = 0; i<res.length; i++){
                    if(res[i].email == email){
                        mine.push({
                            starttime: res[i].start_time,
                            duration: res[i].duration,
                            accepted: res[i].approved
                        });
                    }else{
                        others.push({
                            starttime: res[i].start_time,
                            duration: res[i].duration,
                            accepted: res[i].approved
                        });
                    }
                    
                }

                resolve({mine: mine, others: others});
            });
        })
        
    },
    //date is a date object that is the start time, duration is duration in seconds.
    does_request_overlap_own: async function(date, duration, user_id){
        /*
            check if begin time or end time is between any of the users own..
        */
        return new Promise((resolve, reject) => {
            let start_date = date;
            let end_date = new Date(date.getTime() + duration*1000);
            connection.query("SELECT count(*) FROM timeslots WHERE user_id=? AND"+
                " ((start_time <= ? AND DATE_ADD(start_time, INTERVAL duration SECOND) >= ?)"+
                " OR (start_time <= ? AND DATE_ADD(start_time, INTERVAL duration SECOND) >= ?))",
            [user_id, start_date, start_date, end_date, end_date], 
            function(err, res, fields){
                if(err){
                    return reject({
                        reason: 'Error selecting from timeslots.',
                        client_reason: 'Internal database error.',
                        db_err: err
                    });
                } 
                resolve(res[0]['count(*)'] != 0);
                 
            });
        });
    },
    //date is a date object that is the start time, duration is duration in seconds.
    does_request_overlap_accepted: async function(date, duration){
        /*
            check if begin time or end time is between any approved others. 
        */
        return new Promise((resolve, reject) => {
            let start_date = date;
            let end_date = new Date(date.getTime() + duration*1000);
            connection.query("SELECT count(*) FROM timeslots WHERE approved=1 AND"+
                " ((start_time <= ? AND DATE_ADD(start_time, INTERVAL duration SECOND) >= ?)"+
                " OR (start_time <= ? AND DATE_ADD(start_time, INTERVAL duration SECOND) >= ?))",
            [start_date, start_date, end_date, end_date], 
            function(err, res, fields){
                if(err){
                    return reject({
                        reason: 'Error selecting from timeslots.',
                        client_reason: 'Internal database error.',
                        db_err: err
                    });
                } 
                resolve(res[0]['count(*)'] != 0);
                 
            });
        });
    },
    //date is a date object that is the start time, duration is duration in seconds.
    add_request: async function(date, duration, user_id){
        let self = this;
        return new Promise((resolve, reject) => {
            let overlap_accepted = null;
            let overlap_own = null;
            //This needs to be transactional; 2 connections that read then insert could conflict (first one reads, second reads, both attempt to insert).
            connection.beginTransaction(async function(err){
                if(err){
                    return reject({
                        reason: 'Error beginning transaction.',
                        client_reason: 'Internal database error.',
                        db_err: err
                    });
                }

                try {
                    overlap_accepted = await self.does_request_overlap_accepted(date, duration);
                    overlap_own = await self.does_request_overlap_own(date, duration, user_id);
                }catch(error){
                    return connection.rollback(function(){reject(error)});
                }

                if(overlap_accepted !== false || overlap_own !== false){
                    return connection.rollback(function(){
                        reject({
                            reason: 'Timeslot already taken!',
                            client_reason: 'Requested timeslot overlaps!',
                        });
                    });
                }

                connection.query("INSERT INTO timeslots (user_id, start_time, duration) VALUES (?, ?, ?)", [user_id, date, duration], function(err, res, fields){
                    if(err){
                        return connection.rollback(function(){
                            reject({
                                reason: 'Error inserting into timeslots.',
                                client_reason: 'Internal database error.',
                                db_err: err
                            });
                        });
                        
                    }
                    connection.commit(function(err){
                        if(err){
                            return connection.rollback(function(){
                                reject({
                                    reason: 'Could not commit!',
                                    client_reason: 'Internal database error.',
                                    db_err: err
                                });
                            });
                        }
                        resolve('Succesfully inserted.');
                    });
                });
            });
        });
    }
}