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
    get_login_requests: function(start_at, num_requests){
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
    user_get_timeslot_requests: function(beginDate, endDate, email){
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
        
    }
}