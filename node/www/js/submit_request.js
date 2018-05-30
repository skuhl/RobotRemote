var SubmitRequest = function(){
	var xms = new XMLHttpRequest();
	var form = document.forms.signup;
	var user = form.elements.username.value;
	var pass = form.elements.password.value;
	var reason = form.elements.reason.value;
	if(!user || !pass || !reason) //in the scenario that one of these are missing
		alert('Missing username, password, or reason for request.</br> These items are required.');
	
	xms.onreadystatechange = function(){
		if(this.readyState === 4 && this.status === 200){
			alert('Successfully added user to DB, awaiting approval.');
			//Hey did that just work? maybe
			console.log('Registered user');
			//redirect to home or login???
			location.replace('http://'+ window.location.host + '/Home.html');
		}else if(this.readyState === 4){
			//something goes wrong
			alert('Error adding user to DB, ' + this.responseText);
		}
	}
	xms.open("POST", 'http://' + window.location.host+ '/Request.html', true);
	xms.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
   xms.send(JSON.stringify({username:user, password:pass, reason:reason}));
}