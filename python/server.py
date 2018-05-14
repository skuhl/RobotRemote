from modbus import ModbusThread
from threading import Lock
from socket import socket
from serverconnection import WebserverListenerThread
import json
import time

SETTINGS_FILE = 'settings.json'

def main():
    pressed_data = []
    pressed_data_lock = Lock()

    opts = get_options(SETTINGS_FILE)
    if(opts == None):
        #an error occured, exit
        return
    
    if not opts["disable_modbus"]:
        modbusThread = ModbusThread(opts, pressed_data, pressed_data_lock)
        modbusThread.start()

    serverThread = WebserverListenerThread(opts["socket_port"], opts["key_file"], opts["cert_file"], opts["ca_file"], opts["verbose"])
    serverThread.start()

    while True:
        if serverThread.haserror():
            print('Error in serverThread!')
            break
        #Check for errors with other threads
        time.sleep(0.1)

    if not opts["disable_modbus"]:
        modbusThread.kill()    

def get_options(filename):
    file_dump = ''
    with open(filename, 'r') as file:
        file_dump = file.read()
    
    try:
        options = json.loads(file_dump)

    except json.decoder.JSONDecodeError as exc:
        print('Failed to parse json file!')
        print(exc.msg + ': (' + str(exc.lineno) + ', ' + str(exc.colno) + ')')
        return None
    #TODO do extra argument checking; Make sure everything is of right type,
    #Make sure that values are within an appropriate range, etc.
    return options

if __name__ == '__main__':
    main()