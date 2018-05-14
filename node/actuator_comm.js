const tls = require('tls');
const StringDecoder = require('string_decoder').StringDecoder;

let decoder = new StringDecoder('utf8');

module.exports = {
    //Class for an actuator server.
    //Holds a socket open until it breaks down, essentially.
    Actuator: class {

        constructor(ip, port){
            this.ip = ip;
            this.port = port;
            this.socket = null;
            this.socketOpen = false;
            this.dateConnected = null;
        }

        sendClientDetails(cert, key, ca){
            console.log('creating SSL socket');
            
            let curActuator = this;
            let promise = new Promise((resolve, reject) => {
                
                let secureContext = tls.createSecureContext({
                    key: key,
                    cert: cert,
                    ca: ca
                });

                if(this.socket == null || this.socket.destroyed){
                    let socket = tls.connect({
                        host: this.ip,
                        port: this.port,
                        rejectUnauthorized: true,
                        secureContext: secureContext
                    },
                    function(){
                        socket.info = {
                            data_unread:'',
                            state:'READY',
                            actuator: curActuator,
                            sentData: resolve,
                            failedToSend: reject
                        };
    
                        socket.info.actuator.socketOpen = true;
                        socket.info.actuator.free = false;
                        socket.info.actuator.dateConnected = new Date();
                        socket.info.actuator.socket = socket;
                        
                        console.log("Socket connected!");
                        
                        socket.on('data', handle_data);
                        //send ready message to server
                        socket.write('READY\0', 'utf8');
                    });
                    
                    socket.on('close', function(){
                        this.info.actuator.socketOpen = false;
                        this.destroy();
                    });

                    socket.on('error', function(err){
                        reject("Socket error occured " + err);
                        this.info.actuator.socketOpen = false;
                        this.destroy();
                    });
                }
            });
            
            return promise;
        }

        free(){
            //We may actually want to poll/query each server
            //This is possible, but may be more expensive
            //However, we can more confidently tell if a server
            //is free
            return this.socket == null || !this.socketOpen;
        }
    },
    //Gets the first free actuator server
    getFreeActuator: function(actuators){
        for(let act of actuators){
            if(act.free()){
                return act;
            }
        }
        return null;
    }
};

function handle_data(data){
    console.log(data);
    this.info.data_unread += decoder.write(data);

    if(this.info.data_unread.size > 4096) {
        if(this.info.failedToSend != null) this.info.failedToSend('Too much info from actuator, there must be something wrong.');
        this.info.failedToSend = null;
        this.info.sentData = null;
        this.destroy();
        return;
    } 

    if(this.info.data_unread[this.info.data_unread.length-1] == '\0'){
        
        if(this.info.state == 'READY'){
            if(this.info.data_unread.slice(0, -1).toUpperCase() == 'OK'){
                //send data to server about where the client is

                //Fufill the promise
                if(this.info.sentData != null) this.info.sentData();
                this.info.failedToSend = null;
                this.info.sentData = null;

                this.info.state = 'DONE';
            }else{
                if(this.info.failedToSend != null) this.info.failedToSend("Invalid response from actuator server.");
                this.info.failedToSend = null;
                this.info.sentData = null;
                this.destroy();
            }
        }else if(this.info.state == 'DONE'){
            console.log("Received data after done.");
        }else{
            if(this.info.failedToSend != null) this.info.failedToSend("Reached an unknown state");
            this.info.failedToSend = null;
            this.info.sentData = null;
            this.destroy();
        }

        this.info.data_unread = '';
    }
}