from modbus import ModbusThread
from threading import Lock
from socket import socket
import json

def main():
    pressed_data = []
    pressed_data_lock = Lock()

    opts = get_options('settings.json')
    modbusThread = ModbusThread(opts, pressed_data, pressed_data_lock)
    
    modbusThread.start()

    start_socket(opts, pressed_data, pressed_data_lock)

def get_options(filename):
    file_dump = ''
    with open(filename, 'r') as file:
        file_dump = file.read()
    
    try:
        options = json.loads(file_dump)
    except json.JSONDecodeError as exc:
        print('Failed to parse json file!')
        print(msg + ': (' + exc.lineno + ', ' + exc.colno + ')')
        return None
    #TODO do extra argument checking; Make sure everything is of right type,
    #Make sure that values are within an appropriate range, etc.
    return options

def start_socket(opts, pressed_data, pressed_data_lock):
    with socket() as listening_socket:
        listening_socket.bind((opts['socket_host'], opts['socket_port']))
        #0 so that we only accept 1 connection at a time. (others are rejected)
        listening_socket.listen(0)

        while True:
            client, addr = listening_socket.accept()
            with client:
                cur_recv = ' '
                msg = ''
                while cur_recv != '':
                    cur_recv = client.recv(256).decode('utf-8')
                    msg += cur_recv

            print("Receive message: " + msg)

            pressed_data_lock.acquire()

            pressed_data.clear()
            pressed_data.extend(list(json.loads(msg)['pressed']))

            pressed_data_lock.release()

if __name__ == '__main__':
    main()