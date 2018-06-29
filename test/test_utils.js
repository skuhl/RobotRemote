const https = require('https');
const prompt = require('prompt');

let db_passwords = null;

async function getDBPasswords(){
    if(db_passwords !== null) return db_passwords;
    let schema = {
        admin_user: {
            description: 'Enter the username of the admin mysql user',
            type: 'string',
            default: 'root',
            required: false
        },
        admin_pass: {
            description: 'Enter a password for the admin mysql user',
            type: 'string',
            hidden: true,
            replace: '*',
            required: true
        }
    };

    prompt.start();

    db_passwords = await prompt_promise(schema);
    return db_passwords;
}
//Does a request with a random user. 
//Admin: use and admin user
//path: url to send the request to
//type: type of request ('POST', 'GET', etc.)
//data: data to send with the request
//cert, key, ca: needed data for ssl requests.
//Returns a promise which resolves if it gets a 200 response,
//otherwise rejects.
//The returned data in the promise is an object containing the headers,
//as well as all data received.
function attemptRequest(path, method, port, headers, data, cert, key, ca){
    return new Promise(function(resolve, reject){
        port = port || 443;
        if(typeof data === 'object') data = JSON.stringify(data);
        let body = data === undefined ? data : Buffer.from(data);

        let final_headers = Object.assign(data === undefined ? {} : {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        }, headers === undefined ? {} : headers );

        let opts = {
            host: 'localhost',
            port: port,
            method: method,
            path: path,
            headers: final_headers,
            timeout: 2000,
            cert: cert,
            key: key,
            ca: ca
        }

        let req = https.request(opts, function(res){
            if(res.statusCode >= 400 || res.statusCode <= 199) return reject(new Error(`Mean status code returned (${res.statusCode}).`));
            try{
                extractData(res)
                .then((data)=>resolve({headers: res.headers, data: data}))
                .catch((e)=>{reject(e)});
                
            }catch(err){
                reject(err);
            }
        });

        req.on('error', (e)=>{
            reject(e);
        });

        req.end(body);
    });
}

//Takes in a SeedUser object, and attempts to log them in.
async function login(seed_user, ca){
    let data = `username=${encodeURIComponent(seed_user.email)}&password=${encodeURIComponent(seed_user.password)}`;
    let res = await attemptRequest('/Login.html', 'POST', 3001, {'Content-Type':'application/x-www-form-urlencoded'}, data, undefined, undefined, ca);
    
    if(!(res.data === 'Success')) throw Error(`Invalid response to login: ${res.data}`);
    
    let raw_cookies = res.headers['set-cookie'].find(x => x.split(';')[0].split('=')[0] === 'connect.sid');
    let session_id = decodeURIComponent(raw_cookies.split(';')[0].split('=')[1]);
    return session_id;
}

//Following funcitons are only used internally
function prompt_promise(schema){
    return new Promise((resolve, reject)=>{
        try{
            prompt.get({properties: schema}, function(err, result){
                if(err) return reject(err);
                resolve(result);
            });
        }catch(err){
            reject(err);
        }
    });
}

function extractData(res){
    return new Promise(function(resolve, reject){
        let data = '';
        res.on('data', (chunk)=>{
            data += chunk.toString('utf8');
        });

        res.on('end', ()=>{
            resolve(data);
        });

        res.on('error', (error)=>{reject(error)});
    });
};

//Export functions
module.exports.attemptRequest = attemptRequest;
module.exports.getDBPasswords = getDBPasswords;
module.exports.login = login;
