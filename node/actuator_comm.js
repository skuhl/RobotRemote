const crypto = require('crypto');
const http = require('http');

module.exports = {
    //Class for an actuator server.
    Actuator: class {

        constructor(ip, port, websock_port, client_key, client_cert, server_ca){
            this.ip = ip;
            this.port = port;
            this.websock_port = websock_port;
            this.client_key = client_key;
            this.client_cert = client_cert;
            this.server_ca = server_ca;
            this.webcams = [];
        }

        sendClientDetails(expires_in){
            return new Promise((resolve, reject)=>{
                let secret = crypto.randomBytes(512).toString('base64');
                let body = Buffer.from(JSON.stringify(
                    {
                        secret: secret,
                        expires_in: expires_in
                    }
                ));

                let req = http.request({
                    host: this.ip,
                    port: this.port,
                    method: 'POST',
                    path: '/set_secret',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body)
                    },
                    timeout: 2000,
                    ca: this.server_ca,
                    cert: this.client_cert,
                    key: this.client_key
                }, function(res){
                    if(res.statusCode == 200){
                        resolve(secret)
                    }else{
                        reject(res.statusCode);
                    }
                });

                req.on('error', (e) =>{
                    reject(e);
                });

                req.end(body);
            });
        }
        
        addWebcam(webcam){
            this.webcams.push(webcam);
        }

        getStatus(){
            return new Promise((resolve, reject)=>{
                let req = http.request({
                    host: this.ip,
                    port: this.port,
                    method: 'GET',
                    path: '/status',
                    timeout: 2000,
                    ca: this.server_ca,
                    cert: this.client_cert,
                    key: this.client_key
                }, function(res){
                    if(res.statusCode == 200){
                        let data = '';
                        res.on('data', (chunk)=>{
                            data += chunk.toString('utf8');
                        });

                        res.on('end', ()=>{
                            resolve(data);
                        });

                        res.on('error', (error)=>{reject(error)});
                        
                    }else{
                        reject(res.statusCode);
                    }
                });

                req.on('error', (e) => {reject(e)});

                req.end();
            });
        }
    },
    //Gets the first free actuator server
    getFreeActuator: async function(actuators){
        let promises = [];
        for(let act of actuators){
            promises.push(act.getStatus().then((status) => {
                return {act: act, status: status};
            }));
        }
        
        return Promise.all(promises).then((values) => {
            for(let val of values){
                if(val.status === 'FREE'){
                    return val.act;
                }
            }
            throw 'No free actuators!';
        });
    }
};
