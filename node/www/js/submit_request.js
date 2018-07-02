const log4js = require('log4js');
log4js.configure({
  appenders: {
    info_log: { type: 'file', filename: 'info.log' },
    err_log: { type: 'file', filename: 'err.log' }
  },
  categories: {
    info: { appenders: [ 'info' ], level: 'info' },
    err:  { appenders: ['err_log'], level: 'error'}
  }
});

const info_logger = log4js.getLogger('info');
const err_logger = log4js.getLogger('err');

var SubmitRequest = function(){
	var xms = new XMLHttpRequest();
	var form = document.forms.signup;
	var user = form.elements.username.value;
	var pass = form.elements.password.value;
	var reason = form.elements.reason.value;

	if(!user || !pass || !reason){ //in the scenario that one of these are missing
		alert('Missing username, password, or reason for request.<br/> These items are required.');
		return;
	}
	
	xms.onreadystatechange = function(){
		if(this.readyState === 4 && this.status === 200){
			alert('Successfully signed up, verify your email and wait for approval!');
			//Hey did that just work? maybe
			info_logger.info('SUBMIT_REQUESTS: Registered user');
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