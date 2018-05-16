from modbus import ModbusThread
from threading import Lock
from socket import socket
from serverconnection import ServerProtocol
import ssl
from ssl import SSLContext
import json
import asyncio
import time

SETTINGS_FILE = 'settings.json'

def main():
    pressed_data = []
    pressed_data_lock = Lock()

    opts = get_options(SETTINGS_FILE)
    if opts == None:
        #an error occured, exit
        return
    
    if opts['debug']:
        print('WARNING: Server was started in debug mode. This is insecure, and meant only for testing purposes.')

    if not opts["disable_modbus"]:
        modbusThread = ModbusThread(opts, pressed_data, pressed_data_lock)
        modbusThread.start()

    loop = asyncio.get_event_loop()
    
    def ex_handler(loop, context):
        print('An exeption occured, ' + context['message'])

    loop.set_exception_handler(ex_handler)

    if opts['debug']:
        secure_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        secure_context.load_cert_chain(opts['cert_file'], keyfile = opts['key_file'])
        #secure_context.load_verify_locations(cafile = opts['ca_file'])
        secure_context.verify_mode = ssl.CERT_NONE
    else:
        print('Debug off, creating custom context')
        secure_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH, cafile = opts['ca_file'])
        secure_context.load_cert_chain(opts['cert_file'], keyfile = opts['key_file'])
        secure_context.verify_mode = ssl.CERT_REQUIRED
    
    if opts['verbose']:
        print('Starting up server...')

    #print(secure_context.ciphers)
    '''
    sock = secure_context.wrap_socket(socket(), server_side=True)
    sock.bind(('', 5000))
    sock.listen(0)
    client = sock.accept()
    '''
    #print(client)

    webserver_server = loop.create_server(lambda:  ServerProtocol(secure_context, pressed_data_lock, pressed_data, opts['verbose']), 
        host = '', port = opts['socket_port'], ssl = secure_context, backlog = 1)

    loop.run_until_complete(webserver_server)
    loop.run_forever()
    loop.close()

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