const mysql = require('mysql');
const minutes = 30;

let pool = null;
let db_interval = 0;

module.exports = {
    init_mysql: function(conn_pool){
        pool = conn_pool;
        //Clean the DB every X minutes
        db_interval = setInterval(clean_db, minutes*60*1000);
    },
    /* if num_requests <= 0, we get all requests. */
    get_login_requests: async function(start_at, num_requests){
        let json = [];
        return new Promise((resolve, reject) => {
            pool.getConnection(function(err, connection){   
                if(err){
                    return reject({
                        reason: 'Couldn\'t get connection from pool',
                        client_reason: 'Internal database error.',
                        db_err: err
                    });
                }

                if(num_requests <= 0 ){
                    connection.query('SELECT loginrequests.id, users.email, loginrequests.comment FROM users INNER JOIN loginrequests ON users.loginreq_id = loginrequests.id WHERE email_validated=1', [], function(err, res, fields){    
                        connection.release();
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
                        connection.release();
                        if(err){
                            return reject({
                                reason: 'Error selecting from loginrequests.',
                                client_reason: 'Internal database error.',
                                db_err: err
                            });
                        }
                        
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
        });
    },
    /*Gets info about user with given id. Will use given connection if provided, otherwise uses an independant conneciton */
    get_user_by_id: async function(id, connection){
        return new Promise(function(resolve, reject){
            if(connection){
                connection.query();
            }else{
                pool.query("SELECT * FROM users WHERE id=?", [id], function(err, res, fields){
                    if(err){
                        return reject({
                            reason: "Failed selecting user from DB!",
                            client_reason: "Internal database error",
                            db_err: err
                        });
                    }

                    if(res.length < 1){
                        return reject({
                            reason: "Couldn't find given user!",
                            client_reason: "User does not exist.",
                            db_err: err
                        });
                    }

                    //TODO possibly put other stuff here?
                    resolve({id: res[0].id, email: res[0].email});
                });
            }
        });
        
        
    },
    /*Timeframe is between beginDate and endDate.*/
    user_get_timeslot_requests: async function(beginDate, endDate, user_id){
        return new Promise((resolve, reject) => {
            pool.getConnection(function(err, connection){   
                if(err){
                    return reject({
                        reason: 'Couldn\'t get connection from pool',
                        client_reason: 'Internal database error.',
                        db_err: err
                    });
                }
                connection.query('SELECT id, start_time, duration, approved, user_id FROM timeslots WHERE start_time > ? AND start_time < ?', 
                [beginDate, endDate], function(err, res, fields){
                    connection.release();
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

                        if(res[i].user_id == user_id){
                            mine.push({
                                id: res[i].id,
                                starttime: res[i].start_time,
                                duration: res[i].duration,
                                email: res[i].email,
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
            });
        });
        
    },

    admin_get_timeslot_requests: async function(beginDate, endDate){
        return new Promise((resolve, reject) => {
            pool.getConnection(function(err, connection){   
                if(err){
                    return reject({
                        reason: 'Couldn\'t get connection from pool',
                        client_reason: 'Internal database error.',
                        db_err: err
                    });
                }

                connection.query('SELECT users.email, timeslots.id, timeslots.start_time, timeslots.duration, timeslots.approved'+
                ' FROM timeslots INNER JOIN users ON timeslots.user_id=users.id'+
                ' WHERE start_time >= ? AND start_time < ?', 
                [beginDate, endDate], function(err, res, fields){
                    connection.release();
                    let unapproved = [];
                    let approved = [];
                    if(err){
                        return reject({
                            reason: 'Error selecting from timeslots.',
                            client_reason: 'Internal database error.',
                            db_err: err
                        });
                    }

                    for(let i = 0; i<res.length; i++){
                        if(res[i].approved){
                            approved.push({
                                email: res[i].email,
                                id: res[i].id,
                                starttime: res[i].start_time,
                                duration: res[i].duration,
                            });
                        }else{
                            unapproved.push({
                                email: res[i].email,
                                id: res[i].id,
                                starttime: res[i].start_time,
                                duration: res[i].duration,
                            });
                        }                        
                    }

                    resolve({approved: approved, unapproved: unapproved});
                });
            });
        });
        
    },
    //date is a date object that is the start time, duration is duration in seconds.
    does_request_overlap_own: async function(date, duration, user_id){
        /*
            check if begin time or end time is between any of the users own..
        */
        return new Promise((resolve, reject) => {
            pool.getConnection(function(err, connection){   
                if(err){
                    return reject({
                        reason: 'Couldn\'t get connection from pool',
                        client_reason: 'Internal database error.',
                        db_err: err
                    });
                }
                let start_date = date;
                let end_date = new Date(date.getTime() + duration*1000);
                connection.query("SELECT count(*) FROM timeslots WHERE user_id=? AND"+
                    " ((start_time <= ? AND DATE_ADD(start_time, INTERVAL duration SECOND) >= ?)"+
                    " OR (start_time <= ? AND DATE_ADD(start_time, INTERVAL duration SECOND) >= ?))",
                [user_id, start_date, start_date, end_date, end_date], 
                function(err, res, fields){
                    connection.release();
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
        });
    },
    //date is a date object that is the start time, duration is duration in seconds.
    does_request_overlap_accepted: async function(date, duration){
        /*
            check if begin time or end time is between any approved others. 
        */
        return new Promise((resolve, reject) => {
            pool.getConnection(function(err, connection){   
                if(err){
                    return reject({
                        reason: 'Couldn\'t get connection from pool',
                        client_reason: 'Internal database error.',
                        db_err: err
                    });
                }
                let start_date = date;
                let end_date = new Date(date.getTime() + duration*1000);
                connection.query("SELECT count(*) FROM timeslots WHERE approved=1 AND"+
                    " ((start_time <= ? AND DATE_ADD(start_time, INTERVAL duration SECOND) >= ?)"+
                    " OR (start_time <= ? AND DATE_ADD(start_time, INTERVAL duration SECOND) >= ?))",
                [start_date, start_date, end_date, end_date], 
                function(err, res, fields){
                    connection.release();
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
        });
    },
    //date is a date object that is the start time, duration is duration in seconds.
    add_request: async function(date, duration, user_id){
        let self = this;
        return new Promise((resolve, reject) => {
            pool.getConnection(function(err, connection){   
                if(err){
                    return reject({
                        reason: 'Couldn\'t get connection from pool',
                        client_reason: 'Internal database error.',
                        db_err: err
                    });
                }
                let overlap_accepted = null;
                let overlap_own = null;
                //This needs to be transactional; 2 connections that read then insert could conflict (first one reads, second reads, both attempt to insert).
                connection.beginTransaction(async function(err){
                    if(err){
                        connection.release();
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
                        return connection.rollback(function(){
                            connection.release();
                            reject(error)
                        });
                    }

                    if(overlap_accepted !== false || overlap_own !== false){
                        return connection.rollback(function(){
                            connection.release();
                            reject({
                                reason: 'Timeslot already taken!',
                                client_reason: 'Requested timeslot overlaps!',
                            });
                        });
                    }

                    connection.query("INSERT INTO timeslots (user_id, start_time, duration) VALUES (?, ?, ?)", [user_id, date, duration], function(err, res, fields){
                        if(err){
                            return connection.rollback(function(){
                                connection.release();
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
                                    connection.release();
                                    reject({
                                        reason: 'Could not commit!',
                                        client_reason: 'Internal database error.',
                                        db_err: err
                                    });
                                });
                            }
                            connection.release();
                            resolve('Succesfully inserted.');
                        });
                    });
                });
            });
        });
    },
    delete_request: function(req_id, user_id){
        return new Promise((resolve, reject)=>{
            pool.getConnection(function(err, connection){   
                if(err){
                    return reject({
                        reason: 'Couldn\'t get connection from pool',
                        client_reason: 'Internal database error.',
                        db_err: err
                    });
                }
                connection.query("DELETE FROM timeslots WHERE user_id=? AND id=?", [user_id, req_id], function(err, res, fields){
                    connection.release();
                    if(err){
                        return reject({
                            reason: 'Could not delete!',
                            client_reason: 'Internal database error.',
                            db_err: err
                        });
                    }

                    if(res.affectedRows <= 0){
                        return reject({
                            reason: 'Could not delete! Already deleted OR attempt to delete when it was not their request.',
                            client_reason: 'Already deleted!'
                        });
                    }
                    resolve();
                });
            });
        });
    },
    /*
    Deletes timeslot request with the given ID from the database. 
    On success, returns the ID of the user that was just deleted.
    */
    delete_timeslotrequest_admin: async function(id){
        return new Promise(function(resolve, reject){
            pool.getConnection(function(err, connection){
                if(err){
                    return reject({
                        reason: 'Couldn\'t get connection from pool',
                        client_reason: 'Internal database error.',
                        db_err: err
                    });
                }
                
                connection.query("SELECT user_id FROM timeslots WHERE id=?", [id], function(err, res, fields){
                    if(err){
                        connection.release();
                        return reject({
                            reason: 'Couldn\'t select userid in admin timeslot delete',
                            client_reason: 'Internal database error.',
                            db_err: err
                        });
                    }

                    if(res.length < 1){
                        connection.release();
                        return reject({
                            reason: 'Bad ID for timeslot.',
                            client_reason: 'Couldn\'t find timeslot in database!',
                            db_err: err
                        });
                    }

                    let user_id = res[0].user_id;

                    connection.query("DELETE FROM timeslots WHERE id=?", [id], function(err, res, fields){
                        connection.release();
                        if(err){
                            return reject({
                                reason: 'Couldn\'t select userid in admin timeslot delete',
                                client_reason: 'Internal database error.',
                                db_err: err
                            });
                        }

                        resolve(user_id);
                    });

                });

            });
        });
    }
};

async function clean_db(){
    console.log('Cleaning DB');
    return new Promise((resolve, reject) => {
        pool.getConnection(function(err, connection){
            if(err){
                return reject({
                    reason: 'Couldn\'t get connection from pool',
                    db_err: err
                });
            }
            connection.query("DELETE FROM timeslots WHERE DATE_ADD(start_time, INTERVAL duration SECOND) <= ?", [new Date(Date.now())], function(err, res, fields){
                if(err){
                    connection.release();
                    return reject({
                        reason: 'Couldn\'t delete from timeslots in clean_db.',
                        db_err: err
                    });
                }
                //Deletes logins and requests from over 2 weeks ago, if they have not been approved yet.
                //TODO send out an email to them if this happens?
                connection.query("DELETE FROM loginrequests WHERE date_requested < ?", [new Date(Date.now() - 14*24*60*60*1000)], function(err, res, fields) {
                    connection.release();
                    if(err){
                        return reject({
                            reason: 'Couldn\'t delete from loginrequests in clean_db.',
                            db_err: err
                        });
                    }

                    resolve();
                });
            });
        });
    });
}