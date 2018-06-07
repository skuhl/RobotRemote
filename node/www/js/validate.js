var form = document.forms.signup;
var password = form.elements.password;
var passConfirm = form.elements.REpassword;
var reason = form.elements.reason;

var timeout = null;

function validate()
{
	console.log("I'm being called!");
	clearTimeout(timeout);
	timeout = setTimeout(function(){
		var cap = new RegExp("/([A-Z])/g");
		var low = new RegExp("/([a-z])/g");
		var num = new RegExp("/([0-9])/g");
		var spc = new RegExp("/([ -/]|[:-@]|[[-`]|[{-~])/g");//covers any standard special character
		
		//Check that the passwords match
		if(password.value != passConfirm.value){
			document.getElementById("repass_error").innerHTML = "Passwords don't match";
			document.getElementById("repass_error").style.display = "inline";
		}
		else if(password.value.length != 0 && (password.value.length < 8 || password.value.length > 22)){
			console.log(password.value.length);
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
		}
	},500);
}

password.onkeyup = validate();
passConfirm.onkeyup = validate();
