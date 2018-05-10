from modbus import ModbusThread
from threading import Lock
from socket import socket
import json

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

    #TODO make this socket server a seperate thread.
    #It would make it easier to intercept whether one
    #thread has died/failed.
    start_socket(opts, pressed_data, pressed_data_lock)
    
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


def start_socket(opts, pressed_data, pressed_data_lock):
    with socket() as listening_socket:
        listening_socket.bind((opts['socket_host'], opts['socket_port']))
        #0 so that we only accept 1 connection at a time. (others are rejected)
        listening_socket.listen(0)
        try:
            while True:
                client, addr = listening_socket.accept()
                with client:
                    cur_recv = ' '
                    msg = ''
                    while cur_recv != '':
                        cur_recv = client.recv(256).decode('utf-8')
                        msg += cur_recv
                if opts["verbose"]:
                    print("Receive message: " + msg)

                pressed_data_lock.acquire()

                pressed_data.clear()
                pressed_data.extend(list(json.loads(msg)['pressed']))

                pressed_data_lock.release()
        except herror as err:
            errno, errstr = err
            print('Socket Error (' + errno + '): ' + errstr)
        else:
            print('Some socket error occured.')
    #If this area is reached, we have reached an error. Return to the caller
    #and have them handle it.

if __name__ == '__main__':
    main()