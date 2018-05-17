let socket;
let socket_ready = false;
let pressed_buttons = [];

function SocketMessage(event){
    console.log(event);
}

function SocketReady(){ 
    socket_ready = true;
    //Socket is ready, we need to send our secret
    secret = GetCookie('act-secret');
    console.log(secret);
    socket.send(secret);

    UpdatePresses();
}

function SocketClose(){
    socket_ready = false;
}

function UpdatePresses(){
    socket.send(JSON.stringify({'pressed': pressed_buttons}));
}

var InitSocket = function(){
    socket = new WebSocket('ws://localhost:5001/');
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

function GetCookie(cookie){
    let name = cookie + '=';
    let decoded_cookies = decodeURIComponent(document.cookie);
    let cookie_array = decoded_cookies.split(';');

    let cookie_string = cookie_array.map(function(x){
        return x.trim()
    }).find(function(x){
        return x.startsWith(name);
    });

    if(!cookie_string) return null;

    return cookie_string.slice(name.length).trim();
}

InitSocket();