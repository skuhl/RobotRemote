const http = require('http');
const https = require('https');

module.exports = {
    Webcam: class {
        constructor(actuator, ip, comm_port, sock_port, secure, key, cert, ca){
            this.actuator = actuator;
            this.ip = ip;
            this.comm_port = comm_port;
            this.sock_port = sock_port;
            this.secure = secure;
            this.key = key;
            this.cert = cert;
            this.ca = ca;
        }

        getStatus(){
            return new Promise((resolve, reject)=>{
                let opts = {
                    host: this.ip,
                    port: this.comm_port,
                    method: 'GET',
                    path: '/',
                    timeout: 2000
                };
                
                handler = function(res){
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
                };

                if(this.secure){
                    
                    opts.ca = this.ca;
                    opts.cert = this.cert;
                    opts.key = this.key;

                    var req = https.request(opts, handler);
                }else{
                    var req = http.request(opts, handler);
                }  

                req.on('error', (e) => {
                    reject(e);
                });

                req.end();
            });
        }

        setSecret(secret, time){
            return new Promise((resolve, reject)=>{
                let body = new Buffer(JSON.stringify({secret: secret, expires_in: time}));
                let opts = {
                    timeout: 500,
                    host: this.ip,
                    port: this.comm_port,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body)
                    },
                    path: '/',
                    timeout: 2000
                };

                let handler = function(res){
                    if(res.statusCode == 200){
                        resolve('Success');
                    }else{
                        reject(res.statusCode);
                    }
                }

                if(this.secure){
                    
                    opts.ca = this.ca;
                    opts.cert = this.cert;
                    opts.key = this.key;

                    var req = https.request(opts, handler);
                }else{
                    var req = http.request(opts, handler);
                }

                req.on('error', (e) => {
                    reject(e);
                });

                req.end(body);
            });
        }
    }
}
