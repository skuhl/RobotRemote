import asyncio
import websockets
import json

connection_info_lock = asyncio.Lock() 
connection_info_array = []

class WebSocketConnectionInfo:
    def __init__(self, connected_event, client_secret, server_queue):
        self.connected_event = connected_event
        self.client_secret = client_secret
        self.server_queue = server_queue
        #TODO figure out how to do this asyncronously,
        #such that we can lock before adding to the array.
        connection_info_array.append(self)



class WebSocketServer:
    def __init__(self, accepting_websocks_sem, event_loop, pressed_data_lock, pressed_data):
        self.event_loop = event_loop
        self.connected = True
        self.accepting_websocks_sem = accepting_websocks_sem
        self.pressed_data_lock = pressed_data_lock
        self.pressed_data = pressed_data

    def do_websock(ip, port, accepting_websocks_sem, secure_context, pressed_data_lock, pressed_data):
        global clientConn
        '''
        Starts up a websocket server. This server will connect to 1 client,
        and that's it. 
        '''
        event_loop = asyncio.get_event_loop()

        clientConn = WebSocketServer(accepting_websocks_sem, event_loop, pressed_data_lock, pressed_data)

        if secure_context == None:
            server = websockets.serve(clientConn.websocket_handler, host = ip, port = port, backlog = 0)
        else:
            server = websockets.serve(clientConn.websocket_handler, host = ip, port = port, backlog = 0, ssl = secure_context)

        event_loop.run_until_complete(server)

        return clientConn

    async def websocket_handler(self, websock, uri):
        global connection_info_array
        global connection_info_lock

        try:
            #Give 0.5 seconds for the event to proc. Shouldn't matter if we do this right.
            await asyncio.wait_for(self.accepting_websocks_sem.acquire(), timeout = 0.5 )
        except asyncio.TimeoutError:
            print('Websock attempted to connect when we are not accepting websockets')
            #allow another connection through, might be more than one connecting
            self.accepting_websocks_sem.release()
            websock.close()
            return

        #Check to see if client leads with secret
        try:
            msg = await asyncio.wait_for(websock.recv(), timeout = 1)
        except asyncio.TimeoutError:
            print('Client did not provide secret in time.')
            self.accepting_websocks_sem.release()
            websock.close()
            return

        my_info = None
        await connection_info_lock.acquire()

        for conn_info in connection_info_array:
            print('Checking against \n\"' + conn_info.client_secret + '"')
            print(conn_info.client_secret == msg)
            if conn_info.client_secret == msg:
                print('Found connection corresponding to secret ' + conn_info.client_secret)
                my_info = conn_info
                conn_info.connected_event.set()
                connection_info_array.remove(conn_info)
                break

        connection_info_lock.release()

        #check if we found a matching secret or not
        if my_info == None:
            print('Couldn\'t find secret equal to sent message, \n"' + msg + '"')
            websock.close()
            return

        #loop for websocket.
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
        my_info.server_queue.put_nowait("done")