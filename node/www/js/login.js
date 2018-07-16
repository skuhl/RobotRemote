var CheckError = function(){
    var msg_component = document.getElementById("errmsg");
    
    if(!msg_component) return;
    var msg = msg_component.value;

    document.getElementById("msg_text").innerHTML = msg;
    document.getElementById("msg_container").style.display = "block";
}

function SwitchToVerification(){
    var form_container = document.getElementById('container');
    document.getElementById('pageIDText').innerText = 'Resend Verification Email';
    var extras = document.getElementsByClassName('extraSignin');
    
    for(var i = extras.length - 1; i >= 0; i--){
        extras[i].parentElement.removeChild(extras[i]);
    }

    form_container.getElementsByTagName('form')[0].action = '/resendverification';
}
