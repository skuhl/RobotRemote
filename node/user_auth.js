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
    }
}