var UpdatePass = function(){
	var xms = new XMLHttpRequest();
	var form = document.forms.update;
	var pass = form.elements.password.value;
	
	if(!pass){
		alert('Missing new password!\n Please enter your desired new password in the space provided below.');
		return;
	}
	
	xms.onreadystatechange = function(){
		if(this.readyState === 4 && this.status === 200){
			alert('Successfully updated password!');
			console.log('SUBMIT_REQUESTS: Registered user');
			location.replace('http://'+ window.location.host + '/Home.html');
		}else if(this.readyState === 4){
			alert('Error, ' + this.responseText);
		}
	}
	xms.open("POST", location.protocol + '//' + window.location.host + '/NewPass.html', true);
	xms.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
   xms.send(JSON.stringify({password:pass}));
}