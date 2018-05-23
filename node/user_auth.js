const mysql = require('mysql');
let connection = null;
const crypto = require('crypto');

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
    /* 
    Returns an object, such that said object has a property
    'reason', which will give a reason if verified is false.
    This reason may or may not be sensitive, so this reason will not
    be shown to the client.
    'client_reason' is the reason we give to the client.
    */
    verify_credentials: function(username, password){
        return new Promise ((resolve, reject) => {
            connection.query('SELECT passhash, passsalt, approved from users where email = ?', [username], (err, res, fields)=>{
                if(err){
                    console.log(err);
                    reject({
                        reason: 'Error performing query.',
                        client_reason: 'Internal database error.'
                    });
                    return;
                }
                if(res.length < 1){ 
                    reject({
                        reason: 'Couldn\'t find username in DB.',
                        client_reason: 'Invalid email or password.'
                    }); 
                    return;
                }

                console.log(res);

                if(res.length > 1){
                    reject({
                        reason: 'More than 1 user with given email!',
                        client_reason: 'Internal database error.'
                    });
                    return;
                }

                let hash = crypto.createHash('sha256').update(password + res[0].passsalt).digest('hex');
                
                if(hash !== res[0].passhash){
                    reject({
                        reason: 'Invalid password.',
                        client_reason: 'Invalid email or password.'
                    });
                    return;
                }

                console.log('Approved: ' + res[0].approved);
                if(res[0].approved == false){
                    reject({
                        reason: 'User has not been approved yet.',
                        client_reason: 'Your login is still awaiting approval.'
                    });
                    return;
                }
                //TODO does something need to be passed here? 
                resolve();
            });
        });
    },
    /* 
    Similar to above, but creates a non-approved login_request.
    return value is the same.
    */
   login_request: function(email, password, comment){
        
        return new Promise((resolve, reject) => {
            /*TOOD VALIDATE EMAIL */
            /* TODO SEND VALIDATION EMAIL */
            let salt = crypto.randomBytes(32).toString('hex');
            let email_tok = crypto.randomBytes(16).toString('hex');
            let hash = crypto.createHash('sha256').update(password + salt).digest('hex');
            connection.beginTransaction(function(err){
                if(err) {
                    return reject({
                        reason: 'Failed to start transaction!',
                        client_reason: 'Internal database error.'
                    });
                }
                connection.query('SELECT * FROM users WHERE email = ?', [email], function(err, res, field){
                    if(err){
                        return connection.rollback(function(){
                            reject({
                                reason: 'Failed trying to see if user already in DB.',
                                client_reason: 'Internal database error.'
                            });
                        });
                    }

                    if(res.length > 0){
                        return connection.rollback(function(){
                            reject({
                                reason: 'User already in DB.',
                                client_reason: 'Email already in use.'
                            });
                        });
                    }

                    connection.query('CALL user_request(?, ?, ?, ?, ?)', [email, hash, salt, email_tok, comment], function(err, res, field){
                        if(err){
                            return connection.rollback(function(){
                                reject({
                                    reason: 'Failed to call stored procedure!',
                                    client_reason: 'Internal database error.'
                                });
                            });
                        }
    
                        connection.commit(function(err){
                            if(err){
                                return connection.rollback(function(){
                                    reject({
                                        reason: 'Commit failed!',
                                        client_reason: 'Internal database error.'
                                    });
                                });
                            }
                            
                            //Maybe return something here?
                            resolve();
                        });
                    });
                });
            });
        });
   }
}