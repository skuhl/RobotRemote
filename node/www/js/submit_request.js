var SubmitRequest = function(){
	var xms = new XMLHttpRequest();
	var form = document.forms.signup;
	var user = form.elements.username.value;
	var pass = form.elements.password.value;
	var reason = form.elements.reason.value;

	if(!user || !pass || !reason){ //in the scenario that one of these are missing
		alert('Missing username, password, or reason for request.\n These items are required.');
		return;
	}
	
	xms.onreadystatechange = function(){
		if(this.readyState === 4 && this.status === 200){
			alert('Successfully signed up, verify your email and wait for approval!');
			//Hey did that just work? maybe
			console.log('SUBMIT_REQUESTS: Registered user');
			//redirect to home or login???
			location.replace('http://'+ window.location.host + '/Home.html');
		}else if(this.readyState === 4){
			//something goes wrong
			alert('Error, ' + this.responseText);
		}
	}
	xms.open("POST", location.protocol + '//' + window.location.host + '/Request.html', true);
	xms.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
   xms.send(JSON.stringify({username:user, password:pass, reason:reason}));
}