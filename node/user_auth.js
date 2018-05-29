const mysql = require('mysql');
const crypto = require('crypto');

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
    /* 
    Returns an object, such that said object has a property
    'reason', which will give a reason if verified is false.
    This reason may or may not be sensitive, so this reason will not
    be shown to the client.
    'client_reason' is the reason we give to the client.
    */
    verify_credentials: function(username, password){
        return new Promise ((resolve, reject) => {
            connection.query('SELECT id, passhash, passsalt, approved, admin from users where email = ?', [username], (err, res, fields)=>{
                if(err){
                    console.log(err);
                    reject({
                        reason: 'Error performing query.',
                        client_reason: 'Internal database error.',
                        db_err: err
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
                resolve({is_admin: res[0].admin, id: res[0].id});
            });
        });
    },
    /* 
    Creates a non-approved login_request.
    Return value is the same as above.
    */
   login_request: function(email, password, comment){
        
        return new Promise((resolve, reject) => {
            /*TOOD VALIDATE EMAIL */
            /* TODO SEND VALIDATION EMAIL */
            let salt = crypto.randomBytes(32).toString('hex');
            let email_tok = crypto.randomBytes(16).toString('hex');
            let hash = crypto.createHash('sha256').update(password + salt).digest('hex');

            console.log(salt);
            console.log(email_tok);
            console.log(hash);

            connection.beginTransaction(function(err){
                if(err) {
                    return reject({
                        reason: 'Failed to start transaction!',
                        client_reason: 'Internal database error.',
                        db_err: err
                    });
                }
                connection.query('SELECT * FROM users WHERE email = ?', [email], function(err, res, field){
                    if(err){
                        return connection.rollback(function(){
                            reject({
                                reason: 'Failed trying to see if user already in DB.',
                                client_reason: 'Internal database error.',
                                db_err: err
                            });
                        });
                    }

                    if(res.length > 0){
                        return connection.rollback(function(){
                            reject({
                                reason: 'User already in DB.',
                                client_reason: 'Email already in use.',
                                db_err: null
                            });
                        });
                    }

                    connection.query('CALL user_request(?, ?, ?, ?, ?)', [email, hash, salt, email_tok, comment], function(err, res, field){
                        if(err){
                            return connection.rollback(function(){
                                reject({
                                    reason: 'Failed to call stored procedure!',
                                    client_reason: 'Internal database error.',
                                    db_err: err
                                });
                            });
                        }
    
                        connection.commit(function(err){
                            if(err){
                                return connection.rollback(function(){
                                    reject({
                                        reason: 'Commit failed!',
                                        client_reason: 'Internal database error.',
                                        db_err: err
                                    });
                                });
                            }
                            
                            //Maybe return something here?
                            resolve(email_tok);
                        });
                    });
                });
            });
        });
   },
   email_verify: function(email, email_tok){
   	return new Promise(function(resolve, reject){
   		connection.query('SELECT loginreq_id FROM users WHERE email=?', [email], function(error, results, fields){
   			if(error){
   				return reject({
                  reason: 'Failed to select by email!',
                  client_reason: 'Internal database error.',
                  db_err: error
              });
            }
            if(results.length != 1){
            	return reject({
                  reason: "Couldn't find user with that email!",
                  client_reason: 'Internal database error.',
                  db_err: error
              });
            }
            let request_ID = results[0].loginreq_id;
            if(request_ID == null){
            	return reject({
                  reason: "Request ID was NULL",
                  client_reason: 'Email already verified.',
                  db_err: error
              });
            }
            connection.query('SELECT email_token, email_validated FROM loginrequests where id=?', [request_ID], function(error, results, fields){
            	if(error){
	   				return reject({
	                  reason: 'Failed to select by email!',
	                  client_reason: 'Internal database error.',
	                  db_err: error
              		});
         		}
         		if(results.length < 1){
	            	return reject({
	                  reason: "Invalid request ID!",
	                  client_reason: 'Internal database error.',
	                  db_err: error
           			});
         		}
         		if(results[0].email_validated){
         			return reject({
	                  reason: "Request ID was NULL",
	                  client_reason: 'Email already verified.',
	                  db_err: error
	              });
	            }
	            if(results[0].email_token != email_tok){
	            	return reject({
	                  reason: "Non matching token!",
	                  client_reason: 'Invalid URL.',
	                  db_err: error
	              });
	            }
	            connection.query('UPDATE loginrequests SET email_validated=1 where id=?', [request_ID],function(error, results, fields){
	            	if(error){
		   				return reject({
		                  reason: 'Failed to update!!:(',
		                  client_reason: 'Internal database error.',
		                  db_err: error
	              		});
         			}
         			resolve();
	            });
            });
   		});
   	});
   }
}