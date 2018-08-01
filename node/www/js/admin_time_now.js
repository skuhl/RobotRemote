var AdminTimeNow= function(){

    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function(){
        if(this.readyState === 4 && this.status === 200){
            alert("Successfully requested time slot!");
            //Update table (or remake it, or something)
            console.log('SCHEDULER: Success!');
            //reload the page becuase the table is updated
            location.reload();
        }else if(this.readyState === 4){
            alert("Error submitting time slot request! \n" + this.responseText);
        }
			//re enables the button(disabled somewhere else)
        if(this.readyState === 4){
            //I don't know why, but this doesn't work if it's too quick.
            setTimeout(function(){
                document.getElementById('req_submit').disabled = false;
            }, 1000);
        }
    }

    xhr.open("POST", location.protocol + '//' + window.location.host +  '/admintime', true);
    xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
    xhr.send();
}