const mysql = require('mysql');
let connection = null;
const crypto = require('crypto');

module.exports = {
    init_mysql: function(host, username, password, database){
        connection = mysql.createConnection({
            host: host,
            user: username,
            password: password,
            database: database
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
            connection.connect((err)=>{
                if(err){
                    reject({
                        reason: 'Unable to connect to database',
                        client_reason: 'Unable to connect to database'
                    });
                }
                connection.query('SELECT passhash, passsalt, approved from users where email = ?', [username], (err, res, fields)=>{
                    
                    if(err || res.length < 1){ 
                        reject({
                            reason: 'Couldn\'t find username in DB.',
                            client_reason: 'Invalid email or password.'
                        });
                        return;
                    }
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

                    if(res.approved == false){
                        reject({
                            reason: 'User has not been approved yet.',
                            client_reason: 'Your login is still awaiting approval.'
                        });
                    }
                    //TODO does something need to be passed here? 
                    accept();
                });
            });
        });
        
    }
}