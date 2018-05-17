const tls = require('tls');
const StringDecoder = require('string_decoder').StringDecoder;
const crypto = require('crypto');

let decoder = new StringDecoder('utf8');

module.exports = {
    //Class for an actuator server.
    //Holds a socket open until it breaks down, essentially.
    Actuator: class {

        constructor(ip, port, secure_context){
            this.ip = ip;
            this.port = port;
            this.socket = null;
            this.socketOpen = false;
            this.dateConnected = null;
            this.isFree = true;
            this.secure_context = secure_context;
        }

        async sendClientDetails(){
            let self = this;
            this.isFree = false;
            this.createSocket();

            let promise = new Promise((resolve, reject) => {
                if(self.socket.info.state != 'READY') reject('Started in invalid state, expected READY, was in ' + self.socket.info.state);
                if(self.socket == null || self.socket.destroyed) reject('Socket failed to open.');
                
                self.socket.info.sentData = resolve;
                self.socket.info.failedToSend = reject;

                self.socket.write('READY\0', 'utf8');
                
            });
            
            return promise;
        }

        createSocket(){
            let self = this;

            if(this.socket == null || this.socket.destroyed){
                console.log('creating SSL socket');
                //TODO pull this out and make it global?
                
                this.socket = tls.connect({
                    host: this.ip,
                    port: this.port,
                    secureContext: this.secureContext,
                    rejectUnauthorized: false
                },
                function(){
                    self.socketOpen = true;
                    self.dateConnected = new Date();
                    
                    this.on('data', handle_data);
                });
                
                this.socket.on('close', function(){
                    if(this.info){ 
                        this.info.actuator.socketOpen = false;
                    }
                    this.destroy();
                });

                this.socket.on('error', function(err){
                    if(self.socket && self.socket!=null && self.socket.info && self.socket.info.failedToSend != null){
                        self.socket.info.failedToSend("Socket error occured\n" + err);
                        self.socket.info.failedToSend = null;
                        self.socket.info.sentData = null;
                    }else{
                        console.log(err);
                    }

                    if(this.info){ 
                        this.info.actuator.socketOpen = false;
                    }

                    this.destroy();
                });

                this.socket.info = {
                    data_unread:'',
                    state:'READY',
                    actuator: self,
                    sentData: null,
                    failedToSend: null
                };

            }
        }

        async free(){
            let self = this;
            //if the socket is open, then the socket is certainly free
            return new Promise(async function(resolve, reject){
                if(self.socketOpen){
                    resolve(self.isFree);
                    return;
                }
                
                self.createSocket();
                if(!self.socket || self.socket == null){
                    print(self.socket);
                    reject('Failed to create socket.');
                    return;
                }

                let status_callback = new Promise((resolve, reject) =>{
                    self.socket.info.got_status = resolve;
                    self.socket.info.failed_status_get = reject;
                    console.log('Writing STATUS')
                    self.socket.write('STATUS\0');
                });

                console.log('Awaiting status')
                let status = await status_callback;
                resolve(status == 'FREE');
            });

        }
    },

    //Gets the first free actuator server
    getFreeActuator: async function(actuators){
        return new Promise(async (resolve, reject) => {
            for(let act of actuators){
                console.log('Checking if act is free...');
                let isFree = false;
                try {
                    isFree = await act.free();
                }catch(err){
                    console.log('Error getting actuator: ' + err);
                }
                console.log('isFree: ' + isFree);
                if(isFree){
                    resolve(act);
                    return;
                }
            }
            reject('No free actuators.');
        });
    }
};

function handle_data(data){
    this.info.data_unread += decoder.write(data);

    if(this.info.data_unread.size > 4096) {
        if(this.info.failedToSend != null) this.info.failedToSend('Too much info from actuator, there must be something wrong.');
        this.info.failedToSend = null;
        this.info.sentData = null;
        this.destroy();
        return;
    } 

    if(this.info.data_unread[this.info.data_unread.length-1] == '\0'){
        
        let msg = this.info.data_unread.slice(0, -1).toUpperCase();
        //Messages that may occur in any state....
        

        //Main state machine
        if(this.info.state == 'READY'){
            if(msg == 'OK'){
                //send data to server about where the client is

                //TODO make the number of random bytes configurable?
                secret = crypto.randomBytes(512);
                this.info.client_secret = secret.toString('base64');
                sendString = this.info.client_secret + '\0';
                
                this.write(sendString, 'utf-8');

                this.info.state = 'WAIT_FOR_CLIENT_ACT_ACK'
            //Might these messages be sent in different states?
            }else if( msg == 'FREE' || msg == 'BUSY'){
                if(this.info.got_status && this.info.got_status != null) this.info.got_status(msg);
                this.info.got_status = null;
                this.info.failed_status_get = null;
            }else{
                if(this.info.failedToSend != null) this.info.failedToSend("Invalid response from actuator server.\"" + msg + "\"");
                this.info.failedToSend = null;
                this.info.sentData = null;
                this.destroy();
            }
        }else if(this.info.state == 'WAIT_FOR_CLIENT_ACT_ACK'){
            if(msg == 'OK'){
                
                //Fufill the promise (actuator got our data)
                if(this.info.sentData != null) this.info.sentData(this.info.client_secret);
                this.info.failedToSend = null;
                this.info.sentData = null;
                
                this.info.state = 'WAIT_FOR_CLIENT_ACTUATOR_CONNECTION';
            }else{
                if(this.info.failedToSend != null) this.info.failedToSend("Actuator server did not properly acknowledge request to connect with client.");
                this.info.failedToSend = null;
                this.info.sentData = null;
                this.destroy();
            }
        }else if(this.info.state == 'WAIT_FOR_CLIENT_ACTUATOR_CONNECTION'){
            if(msg != 'CONNECTED'){
                console.log('Client failed to connect to actuator server. ' + msg);
                this.info.state = 'READY'
                this.info.actuator.isFree = true;
            }else{
                this.info.state = 'WAIT_FOR_FREE';
            }
        }else if(this.info.state == 'WAIT_FOR_FREE'){
            if(msg == 'FREE'){
                console.log('Got FREE.')
                this.info.actuator.isFree = true;
                this.info.state = 'READY';
            }else{
                console.log('Malformed message in WAIT_FOR_FREE state: ' + msg);
                this.destroy();
            }
        }else {
            if(this.info.failedToSend != null) this.info.failedToSend("Reached an unknown state");
            this.info.failedToSend = null;
            this.info.sentData = null;
            this.destroy();
        }

        this.info.data_unread = '';
    }
}