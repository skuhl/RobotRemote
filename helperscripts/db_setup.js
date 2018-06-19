//This script sets up the database by
//Executing db_setup.sql.
//This script injects variables into the setup sql, so just running that sql will
//get you into trouble.
//Usage: npm db_setup -- <mysql_host> <current_host> <admin_user> [<admin_user_password> <new_user_password>]
//This script will prompt for the password for the admin user, 
//as well as for a new password for the new user, if not provided

const fs = require('fs');
const prompt = require('prompt');
const mysql = require('mysql2/promise');

async function main(){

    var mysql_admin_pass, mysql_new_pass;
    
    if(process.argv.length === 5){
        let schema = {
            admin_pass: {
                description: 'Enter the admin password',
                type: 'string',
                hidden: true,
                replace: '*',
                required: true
            },
            new_pass: {
                description: 'Enter a password for the new user',
                type: 'string',
                hidden: true,
                replace: '*',
                required: true
            }
        }

        prompt.start();

        let result = prompt_promise(schema);

        mysql_admin_pass = result.admin_pass;
        mysql_new_pass = result.new_pass;

    }else if(process.argv.length === 7){
        mysql_admin_pass = process.argv[5];
        mysql_new_pass = process.argv[6];
    }else{
        throw 'Invalid number of arguments!\n' +
        'Usage: node db_setup.js <mysql_host> <current_host> <admin_user> [<admin_user_password> <new_user_password>]';
    }

    var mysql_host = process.argv[2].split(':', 2)[0];
    var mysql_port = process.argv[2].split(':', 2).length >= 2 ? Number(process.argv[2].split(':', 2)[1]) : 3306;
    var mysql_current_host = process.argv[3];
    var mysql_user = process.argv[4];
    
    let sql = injectVariables(fs.readFileSync(__dirname + '/db_setup.sql','utf8'), 
        {host: mysql_current_host, password: mysql_new_pass});

    let connection = await mysql.createConnection({
        host: mysql_host,
        port: mysql_port,
        user: mysql_user,
        password: mysql_admin_pass,
        multipleStatements: true
    });

    await connection.query(sql, []);
    
    await connection.end();

    return;
}

/* 
Puts the given variables into the text, replacing areas with {variable} 
syntax.
*/
function injectVariables(text, variables){
    for(let key of Object.keys(variables)){
        let regex_str = '{\\s*' + key + '\\s*}';
        let regex = new RegExp(regex_str, 'g');
        text = text.replace(regex, variables[key]);
    }
    return text;
}
/* Promise wrapper for prompt. */
function prompt_promise(schema){
    return new Promise((resolve, reject)=>{
        prompt.get(schema, function(err, result){
            if(err) return reject(err);
            resolve(result);
        })
    });
}

main().then(()=>{
    console.log('Completed DB setup!');
})
.catch((err)=>{
    console.log("An error occured!");
    console.log(err);
    process.exit(1);
});
