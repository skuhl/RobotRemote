var CheckError = function(){
    let msg_component = document.getElementById("errmsg");
    
    if(!msg_component) return;
    let msg = msg_component.value;

    document.getElementById("error_text").innerHTML = msg;
}
