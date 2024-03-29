var form = document.forms.signup;
var reason;
var password;
var passConfirm;

if(form == null){
	form = document.forms.update;	
}else {
	reason = form.elements.reason;
}

password = form.elements.password;
passConfirm = form.elements.REpassword;


var timeout = null;

function validate()
{
	document.getElementById("sub_btn").disabled = true;
	
	var pass = [0,0];

	var cap = /([A-Z])/;
	var low = /([a-z])/;
	var num = /([0-9])/;
	var spc = /([ -/]|[:-@]|[[-`]|[{-~])/; //covers any standard special character
	
	clearTimeout(timeout);
	
	timeout = setTimeout(function () {
	
		//Check that the passwords match
		if(password.value != passConfirm.value && password.value.length != 0 && passConfirm.value.length != 0){
			document.getElementById("repass_error").innerHTML = "Passwords don't match";
			document.getElementById("repass_error").style.display = "inline";
		}
		else{
			document.getElementById("repass_error").innerHTML = "";
			document.getElementById("repass_error").style.display = "none";
			pass[0] = 1;
		}
		
		if(password.value.length != 0 && (password.value.length < 8 || password.value.length > 22)){
			document.getElementById("pass_error").innerHTML = "Password should be 8-22 characters";
			document.getElementById("pass_error").style.display = "inline";
		}
		else if(password.value.length != 0 && !cap.test(password.value)){
			document.getElementById("pass_error").innerHTML = "Missing a capital letter";
			document.getElementById("pass_error").style.display = "inline";
		}
		else if(password.value.length != 0 && !low.test(password.value)){
			document.getElementById("pass_error").innerHTML = "Missing a lower case letter";
			document.getElementById("pass_error").style.display = "inline";
		}
		else if(password.value.length != 0 && !num.test(password.value)){
			document.getElementById("pass_error").innerHTML = "Missing a number";
			document.getElementById("pass_error").style.display = "inline";
		}
		else if(password.value.length != 0 && !spc.test(password.value)){
			document.getElementById("pass_error").innerHTML = "Missing a special character";
			document.getElementById("pass_error").style.display = "inline";
		}
		else{
			document.getElementById("pass_error").innerHTML = "";
			document.getElementById("pass_error").style.display = "none";
			pass[1] = 1;
		}
		
		if(pass[0] == 1 && pass[1] ==1){
			document.getElementById("sub_btn").disabled = false;
		}
	}, 500);
}
