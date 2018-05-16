import asyncio
import websockets
import json

clientConn = None

#TODO Either re-write for asyncio, or run this on another thread
# Don't really have a preference
# Although the asyncio stuff doesn't look half bad.

class ClientConnection:
    def __init__(self, secret, event_loop, pressed_data_lock, pressed_data, server_conn):
        self.secret = secret
        self.event_loop = event_loop
        self.connected = True
        self.pressed_data_lock = pressed_data_lock
        self.pressed_data = pressed_data
        self.server_conn = server_conn

    def kill(self):
        event_loop.stop()

    def do_websock(ip, port, secret, certfile, keyfile, ca_file, pressed_data_lock, pressed_data, server_conn):
        global clientConn
        '''
        Starts up a websocket server. This server will connect to 1 client,
        and that's it. 
        '''
        #TODO SSL context
        #TODO if a connection isn't received in X seconds,
        #give up.
        event_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(event_loop)

        server = websockets.serve(ClientConnection.websocket_handler, host = ip, port = port, backlog = 0)

        clientConn = ClientConnection(secret, event_loop, pressed_data_lock, pressed_data, server_conn)

        connected = True

        something = event_loop.run_until_complete(server)
        print(something)
        something2 = event_loop.run_forever()
        print(something2)
        return clientConn

    async def websocket_handler(websock, uri):
        global clientConn

        #Check to see if client leads with secret


        while True:
            try:
                msg = await asyncio.wait_for(websock.recv(), timeout=5)
            except asyncio.TimeoutError:
                # No data in 5 seconds, check the connection.
                try:
                    pong_waiter = await websock.ping()
                    await asyncio.wait_for(pong_waiter, timeout=5)
                except asyncio.TimeoutError:
                    print('Websocket timeout')
                    # No response to ping in 5 seconds, disconnect.
                    #TODO tell webserver that this connection is closed
                    break
            except websockets.exceptions.ConnectionClosed:
                #TODO tell webserver that this connection is closed
                print("Websocket connection closed")
                break
            else:
                print(msg)

                clientConn.pressed_data_lock.acquire()

                clientConn.pressed_data.clear()
                clientConn.pressed_data.extend(list(json.loads(msg)['pressed']))
                
                clientConn.pressed_data_lock.release()
        #cleanup
        websock.close()
        clientConn.server_conn.signal_free()