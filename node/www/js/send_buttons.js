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
    socket.send(secret);

    UpdatePresses();
}

function SocketError(err){
	console.log('Socket encountered an error.');
	console.log(err);
}

function SocketClose(){
    socket_ready = false;
}

function UpdatePresses(){
    socket.send(JSON.stringify({'pressed': pressed_buttons}));
}

var InitSocket = function(){
    socket = new WebSocket('wss://' + GetCookie('act-url'));
    socket.onopen = SocketReady;
    socket.onmessage = SocketMessage;
    socket.onerror = SocketError;
    socket.onclose = SocketClose;
    console.log(socket);
}

var ButtonPressed = function(button_code){
	//don't add duplicates
	if(pressed_buttons.find(function(x){return x == button_code}) != undefined) return;
	
	pressed_buttons.push(button_code);
    if(socket_ready){
        UpdatePresses();
    }
}

var ButtonReleased = function(button_code){
	pressed_buttons = pressed_buttons.filter(function(x){return x!=button_code});
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

function replacePort(num){
    let secret = GetCookie("webcam" + num + "-secret");	//get the cookie with port password
    let ws = GetCookie("webcam-" + num);						//get cookie with IP and port
	let cam = document.getElementById("cam" + num);		//get the correct camera based on arg
	if(ws == null || secret == null) return;
    var player = new JSMpeg.Player(ws + "/" + encodeURIComponent(secret), {canvas:cam, autoplay: true});
}

function keyDown(event){ 
    if(event.repeat) return;
	//let text = String.fromCharCode(e);
	let text = event.keyCode;
	console.log("I got called with key code: " + text);	
	event.preventDefault();
	switch(text){
	 	case 112: // F1
			ButtonPressed('F1');
			break;
		case 113: // F2
			ButtonPressed('F2');
			break;
		case 114: // F3
			ButtonPressed('F3');
			break;
		case 115: // F4
			ButtonPressed('F4');
			break;
		case 116: // F5
			ButtonPressed('F5');
			break;
		case 16: //shift unicode
			ButtonPressed('SHIFT');
			break;
		case 13: //enter unicode
			ButtonPressed('ENTER');
			break;
		case 8:  //backspace
			ButtonPressed('BKSPC');
			break;
		case 38: //ArrowUp
			ButtonPressed('^');
			break;
		case 40: //ArrowDown
			ButtonPressed('v');
			break;
		case 37: //ArrowLeft
			ButtonPressed('<');
			break;
		case 39: //ArrowRight
			ButtonPressed('>');
			break;
		case 48: // 0
			ButtonPressed('0');
			break;
		case 49: // 1
			ButtonPressed('1');
			break;
		case 50: // 2
			ButtonPressed('2');
			break;
		case 51: // 3
			ButtonPressed('3');
			break;
		case 52: // 4
			ButtonPressed('4');
			break;
		case 53: // 5
			ButtonPressed('5');
			break;
		case 54: // 6
			ButtonPressed('6');
			break;
		case 55: // 7
			ButtonPressed('7');
			break;
		case 56: // 8
			ButtonPressed('8');
			break;
		case 57: // 9
			ButtonPressed('9');
			break;
		case 46: // . (period)
			ButtonPressed('.');
			break;
		case 44: // , (comma)
			ButtonPressed(',');
			break;
		case 45: // - (dash)
			ButtonPressed('-');
			break;
		default:
			break;
	}
}

function keyUp(event){
	let text = event.keyCode;
	event.preventDefault();
	switch(text){
	 	case 112: // F1
			ButtonReleased('F1');
			break;
		case 113: // F2
			ButtonReleased('F2');
			break;
		case 114: // F3
			ButtonReleased('F3');
			break;
		case 115: // F4
			ButtonReleased('F4');
			break;
		case 116: // F5
            ButtonReleased('F5');
			break; 
		case 16: //shift unicode
			ButtonReleased('SHIFT');
			break;
		case 13: //enter unicode
			ButtonReleased('ENTER');
			break;
		case 8:  //backspace
			ButtonReleased('BKSPC');
			break;
		case 38: //ArrowUp
			ButtonReleased('^');
			break;
		case 40: //ArrowDown
			ButtonReleased('v');
			break;
		case 37: //ArrowLeft
			ButtonReleased('<');
			break;
		case 39: //ArrowRight
			ButtonReleased('>');
			break;
		case 48: // 0
			ButtonReleased('0');
			break;
		case 49: // 1
			ButtonReleased('1');
			break;
		case 50: // 2
			ButtonReleased('2');
			break;
		case 51: // 3
			ButtonReleased('3');
			break;
		case 52: // 4
			ButtonReleased('4');
			break;
		case 53: // 5
			ButtonReleased('5');
			break;
		case 54: // 6
			ButtonReleased('6');
			break;
		case 55: // 7
			ButtonReleased('7');
			break;
		case 56: // 8
			ButtonReleased('8');
			break;
		case 57: // 9
			ButtonReleased('9');
			break;
		case 46: // . (period)
			ButtonReleased('.');
			break;
		case 44: // , (comma)
			ButtonReleased(',');
			break;
		case 45: // - (dash)
			ButtonReleased('-');
			break;
		default:
			break;
	}
}

InitSocket();
