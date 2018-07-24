const mysql = require('mysql2/promise');
const crypto = require('crypto');

let pool = null;

module.exports = {
    init_mysql: function(conn_pool){
        pool = conn_pool;
    },

    verify_credentials: async function(username, password){
        let connection = await pool.getConnection();
        try{
            var [res, field] = await connection.query('SELECT id, passhash, passsalt, approved, admin from users where email = ?', [username]);
        }finally{
            connection.release();
        }

        if(res.length < 1){
            throw {
                reason: 'Couldn\'t find username in DB.',
                client_reason: 'Invalid email or password.'
            }
        }

        
        if(res.length > 1){
            throw {
                reason: 'More than 1 user with given email!',
                client_reason: 'Internal database error.'
            };
        }

        let hash = crypto.createHash('sha256').update(password + res[0].passsalt).digest('hex');
        
        if(hash !== res[0].passhash){
            throw {
                reason: 'Invalid password.',
                client_reason: 'Invalid email or password.'
            };
        }

        if(res[0].approved == false){
            throw {
                reason: 'User has not been approved yet.',
                client_reason: 'Your login is still awaiting approval.'
            };
        }
        
        return {is_admin: res[0].admin, id: res[0].id};
    },

    valid_user: async function (username, password){
        let connection = await pool.getConnection();
            
        try{
            var [res, field] = await connection.query('SELECT id, passhash, passsalt, approved, admin from users where email = ?', [username]);
        }finally{
            connection.release();
        }

        if(res.length < 1){
            throw {
                reason: 'Couldn\'t find username in DB.',
                client_reason: 'Invalid email or password.'
            }
        }

        
        if(res.length > 1){
            throw {
                reason: 'More than 1 user with given email!',
                client_reason: 'Internal database error.'
            };
        }

        let hash = crypto.createHash('sha256').update(password + res[0].passsalt).digest('hex');

        if(hash !== res[0].passhash){
            throw {
                reason: 'Invalid password.',
                client_reason: 'Invalid email or password.'
            };
        }

        return {is_admin: res[0].admin, id: res[0].id};
    },

    needs_verification : async function(user_id){
        let connection = await pool.getConnection();
            
        try{
            var [res, field] = await connection.query('SELECT loginreq_id FROM users WHERE id=?', [user_id]);

            if(res.length < 1){
                throw {
                    reason: 'Couldn\'t find username in DB.',
                    client_reason: 'Invalid email or password.'
                }
            }

            if(res[0].loginreq_id === null){
                return {needs_verif: false, email_token: null};
            }

            let [res1, fields1] = await connection.query('SELECT email_validated, email_token FROM loginrequests WHERE id=?', [res[0].loginreq_id]);

            if(res1.length < 1){
                throw {
                    reason: 'Couldn\'t find login request in DB.',
                    client_reason: 'Internal server error.'
                }
            }

            return {needs_verif: !res1[0].email_validated, email_token: res1[0].email_token};

        }finally{
            connection.release();
        }

        
    },
    /* 
    Creates a non-approved login_request.
    Return value is the same as above.
    */
   login_request: async function(email, password, comment){
        
        
        let connection = await pool.getConnection();
        
        let salt = crypto.randomBytes(32).toString('hex');
        let email_tok = crypto.randomBytes(16).toString('hex');
        let hash = crypto.createHash('sha256').update(password + salt).digest('hex');
        
        await connection.beginTransaction();
        try{
            let [res, fields] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);
                
            if(res.length > 0){
                throw {
                    reason: 'User already in DB.',
                    client_reason: 'Email already in use.',
                };
            }

            await connection.query('CALL user_request(?, ?, ?, ?, ?)', [email, hash, salt, email_tok, comment]);
            await connection.commit();
        }catch(e){
            await connection.rollback();
            throw e;
        }finally{
            connection.release();
        }

        return email_tok;
   },
   email_verify: async function(email, email_tok){
        let connection = await pool.getConnection();
        try{
            let [results, fields] = await connection.query('SELECT loginreq_id FROM users WHERE email=?', [email]);
            
            if(results.length != 1){
                throw {
                    reason: "Couldn't find user with that email!",
                    client_reason: 'Invalid query string.'
                }
            }

            let request_ID = results[0].loginreq_id;
            
            if(request_ID == null){
                throw {
                    reason: "Request ID was NULL",
                    client_reason: 'Email already verified.'
                };
            }

            let [results1, fields1] = await connection.query('SELECT email_token, email_validated FROM loginrequests where id=?', [request_ID]);

            if(results1.length < 1){
                throw {
                    reason: "Invalid request ID!",
                    client_reason: 'Internal database error.'
                };
            }

            if(results1[0].email_validated){
                throw {
                    reason: "Request ID was NULL",
                    client_reason: 'Email already verified.'
                }
            }

            if(results1[0].email_token != email_tok){
                throw {
                    reason: "Non matching token!",
                    client_reason: 'Invalid email token.'
                };
            }

            await connection.query('UPDATE loginrequests SET email_validated=1 where id=?', [request_ID]);
        
        }finally{
            connection.release();
        }

        return;
    },
    update_passwword: async function(email, new_pass){
      let salt = crypto.randomBytes(32).toString('hex');
      let hash = crypto.createHash('sha256').update(new_pass + salt).digest('hex');
		let connection = await pool.getConnection();
   	
   	try{
   		var [res, fields] = await connection.query('UPDATE users SET passhash= ?, passsalt=? WHERE email=?' [hash, salt, email]);
   		
         if(results.length != 1){
             throw {
                 reason: "Couldn't find user with that email!",
                 client_reason: 'Invalid query string.'
             }
         }
      }finally{
       	connection.release();
   	}
   	return;
      }
}
