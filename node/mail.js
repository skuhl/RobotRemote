const nodemailer = require("nodemailer");
const mysql = require('mysql2/promise');
const fs = require('fs');
const db_fetch = require('./db_fetch');

let pool = null;
let mailer = null;
let transport = null;

module.exports = {
    init_mail: function(mysql_pool, sender, host, port, secure, auth){
        pool = mysql_pool;
        mailer = sender;

        transport = nodemailer.createTransport({
            host: host,
            port: port,
            secure: secure,
            auth: auth
        });

    },
    mail_to_admins: async function(file, variables){
        let base_options = await get_mail_message(file, variables);
        let connection = await pool.getConnection();
        try{
            let [res, fields] = await connection.query('SELECT email FROM users WHERE admin=1', []);

            for(let i = 0; i < res.length; i++){
                base_options.to = res[i].email;
                await transport.sendMail(base_options);
            }

        }finally{
            connection.release();
        }
    },
    mail_to_user: async function(user_id, file, variables){
        let db_promise = db_fetch.get_user_by_id(user_id);
        let message = await get_mail_message(file, variables);
        let user = await db_promise;

        message.to = user.email;

        let res = await transport.sendMail(message);
    },
    mail: async function(email, file, variables){
        let message = await get_mail_message(file, variables);
        message.to = email;
        let res = await transport.sendMail(message);
        
        return;
    }
}
/*All relevant message fields are filled, except for the to field. */
async function get_mail_message(file, variables){
    let text = injectVariables(fs.readFileSync(file, {encoding: 'utf8'}), variables);
    let subject = text.split('\n', 1)[0];
    //This regex matches the html document within the file.
    //Anything that starts with <html> and ends with </html> is considered an html document.
    //This isn't super rigerous, but it doesn't need to be.
    let html_regex = /<html>[^]*?<\/html>/;
    let res = html_regex.exec(text);

    if(res == null){
        throw "Bad file, check to make sure '" + file + "' is properly fromatted!";
    }

    let html = res[0];

    return {
        from: mailer,
        subject: subject,
        html: html,
        text: 'Possible plaintext?'
    };
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