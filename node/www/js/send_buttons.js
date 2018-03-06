let socket;
let socket_ready = false;
let pressed_buttons = [];

function SocketMessage(event){
    console.log(event);
}

function SocketReady(){ 
    socket_ready = true;
    UpdatePresses();
}

function SocketClose(){
    socket_ready = false;
}

function UpdatePresses(){
    socket.send(JSON.stringify({'pressed': pressed_buttons}));
}

var InitSocket = function(){
    socket = new WebSocket('ws://localhost:3000/');
    socket.onopen = SocketReady;
    socket.onmessage = SocketMessage;
    socket.onerror = SocketClose();
    socket.onclose = SocketClose();
    console.log(socket);
}

var ButtonPressed = function(num){
    pressed_buttons.push(num);
    if(socket_ready){
        UpdatePresses();
    }
}

var ButtonReleased = function(num){
    pressed_buttons = pressed_buttons.filter((x) => x!=num);
    if(socket_ready){
        UpdatePresses();
    }
}

InitSocket();