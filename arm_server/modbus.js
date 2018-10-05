const modbus = require('jsmodbus');
const net = require('net');

class Run {
    constructor(run_start, run_length, values){
        this._run_length = run_length;
        this._run_start = run_start;
        this._values = values;
    }

    includesPin(pin){
        return this._run_start <= pin && pin < this._run_start + this._run_length;
    }

    get run_length(){
        return this._run_length;
    }

    get run_start(){
        return this._run_start;
    }

    get values(){
        return this._values;
    }
}

module.exports = {
    PLCConnection: class {
        constructor(host, port, slave_num, pin_assignments, conn_timeout, wait_interval, logger){
            this.socket_options = {
                host: host,
                port: port
            };

            this._wait_interval = wait_interval;
            this._pin_assignments = pin_assignments;
            this._runs = [];
            this._logger = logger;
            this._slave_num - slave_num;
           
            this._createSocket();

            this._emitInterval = null;

            this._socket.connect(this.socket_options);
        }

        _emit(){
            for(let run of this._runs){
                //this._logger.debug('Run: ', run);
                this._client.writeMultipleCoils(run.run_start, run.values, run.run_length);
            }
        }

        _createSocket(){
            this._socket = new net.Socket();
            this._client = new modbus.client.TCP(this._socket, this._slave_num);

            this._socket.on('ready', function(){
                this._logger.debug('Got connection to socket, writing out to client.');
                
                this._emit();
                
                if(this._emitInterval === null){
                    this._emitInterval = setInterval(this._emit.bind(this), this._wait_interval * 1000);
                }
            }.bind(this));

            this._socket.on('close', function(){
                if(this._emitInterval !== null){
                    clearInterval(this._emitInterval);
                }
                this._emitInterval = null;
                setTimeout(function(){
                    this._logger.debug('Attempting to reconnect...');
                    this._socket.connect(this.socket_options);
                }.bind(this), 5000); // Wait 5 sec before trying again
            }.bind(this));

            this._socket.on('error', function(error){
                this._logger.error(error);
                this._destroySocket();
                this._createSocket(); 
            }.bind(this));
        }

        _destroySocket(){
            this._socket.destroy();
            this._socket = null;
            this._client = null;
        }

        setPressed(button_array){
            //TODO put back logging here?
            /*
            this._logger.debug('Pushed buttons: ');
            this._logger.debug(button_array);
            */
            this._runs = this._getRuns(button_array);
        }
        
        //returns an array of runs, from array of buttons
        _getRuns(button_array){
            let runs = [];
            let pin_values = Object.keys(this._pin_assignments).map(x => {
                return {   
                    value: button_array.includes(x) ? 1 : 0,
                    pin: this._pin_assignments[x]
                }
            });
            
            pin_values.sort((a, b) => a.pin - b.pin);
            let last_pin = pin_values[0].pin;
            let run_start = pin_values[0].pin;
            let values = [ pin_values[0].value ];
            
            for(let i = 1; i < pin_values.length; i++){    
                if(last_pin + 1 != pin_values[i].pin){
                    runs.push(new Run(run_start, last_pin - run_start + 1, values));
                    run_start = pin_values[i].pin;
                    values = []
                }

                values.push(pin_values[i].value);
                last_pin = pin_values[i].pin;
            }

            //final iteration, we always miss the last run in the above loop
            runs.push(new Run(run_start, last_pin - run_start + 1, values));
            
            return runs;
        }

        end(){
            this._socket.end();
        }
    }
}
