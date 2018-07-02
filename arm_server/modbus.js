const modbus = require('jsmodbus');
const net = require('net');
const Reconnect = require('node-net-reconnect');

const log4js = require('log4js');
log4js.configure({
  appenders: {
    info_log: { type: 'file', filename: 'info.log' },
    err_log: { type: 'file', filename: 'err.log' }
  },
  categories: {
    info: { appenders: [ 'info' ], level: 'info' },
    err:  { appenders: ['err_log'], level: 'error'}
  }
});

const info_logger = log4js.getLogger('info');
const err_logger = log4js.getLogger('err');

class Run {
    constructor(run_start, run_length){
        this._run_length = run_length;
        this._run_start = run_start;
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

    getValues(){
        let vals = [];
        for(let i = 0; i < this._run_length; i++) vals.push(1);
        return vals;
    }
}

module.exports = {
    PLCConnection: class {
        constructor(host, port, slave_num, pin_assignments, conn_timeout, wait_interval){
            let options = {
                host: host,
                port: port,
                retryTime: wait_interval,
                retryAlways: true
            };
            
            this._socket = new net.Socket();
            this._recon = new Reconnect(this._socket, options);
            this._client = new modbus.client.TCP(this._socket, slave_num);
            this._pin_assignments = pin_assignments;
            this._runs = [];

            this._socket.on('connect', function(){
                //write all the runs over the client connection.
                for(let run of this._runs){
                    this._client.writeMultipleCoils(run.run_start, run.getValues(), run.run_length);
                }
                //Close the socket. This will be reopened by Reconnect in wait_interval milliseconds.
                this._socket.end();
            }.bind(this));

            this._socket.connect(options);
        }
        
        setPressed(button_array){
            info_logger.info('Pressed: ' + button_array);
            this._runs = this._getRuns(button_array);
        }
        
        //returns an array of runs, from array of buttons
        _getRuns(button_array){
            if(button_array.length <= 0){
                return [];
            }

            let pins = button_array.map(x => this._pin_assignments[x]);
            pins.sort((a, b) => a - b);
            let last_pin = pins[0];
            let run_start = pins[0];
            let runs = [];

            for(let i = 1; i < pins.length; i++){    
                if(last_pin + 1 != pins[i]){
                    runs.push(new Run(run_start, last_pin - run_start + 1));
                    run_start = pins[i];
                }
                last_pin = pins[i];
            }
            //final iteration, we always miss the last run in the above loop
            runs.push(new Run(run_start, last_pin - run_start + 1));
            return runs;
        }

        end(){
            this._recon.end();
            this._socket.end();
        }
    }
}
