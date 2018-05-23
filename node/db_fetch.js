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
                connection.query('SELECT id, email, comment FROM loginrequests WHERE email_validated=1', [], function(err, res, fields){    
                    if(err){
                        reject({
                            reason: 'Error selecting from loginrequests.',
                            client_reason: 'Internal database error.',
                            db_err: err
                        });
                    }
                    //Is this necessary? Could we just do json = res? 
                    for(col of res){
                        json.push({
                            id: col.id,
                            email: col.email,
                            reason: col.reason
                        });
                    }
                    resolve(json);
    
                });
            }else{
                connection.query('SELECT id, email, comment FROM loginrequests WHERE email_validated=1 LIMIT ? OFFSET ?', [num_requests, start_at], function(err, res, fields){    
                    if(err){
                        reject({
                            reason: 'Error selecting from loginrequests.',
                            client_reason: 'Internal database error.',
                            db_err: err
                        });
                    }
                    //Is this necessary? Could we just do json = res? 
                    for(col of res){
                        json.push({
                            id: col.id,
                            email: col.email,
                            reason: col.reason
                        });
                    }
                    resolve(json);
    
                });
            }
        });
    }
}