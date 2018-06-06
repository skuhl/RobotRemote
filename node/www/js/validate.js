var form = document.forms.signup;
var password = form.elements.password;
var passConfirm = form.elements.REpassword;
var reason = form.elements.reason;

var timeout = null;

function validate()
{
	clearTimeout(timeout);
	timeout = setTimeout(function(){
		var cap = new RegExp("/([A-Z])/g");
		var low = new RegExp("/([a-z])/g");
		var num = new RegExp("/([0-9])/g");
		var spc = new RegExp("/([ -/]|[:-@]|[[-`]|[{-~])/g");//covers any standard special character
		
		//Check that the passwords match
		if(password.value != passConfirm.value)
		{
			passConfirm.setCustomValidity("Passwords don't match!");
		}
		else if(password.value.length < 8 || password.value.length > 22){
			console.log(password.value.length);
			password.setCustomValidity("Password should be 8-22 characters");
		}
		else if(!cap.test(password.value)){
			passConfirm.setCustomValidity("Missing a capital letter");
		}
		else if(!low.test(password.value)){
			passConfirm.setCustomValidity("Missing a lower case letter");
		}
		else if(!num.test(password.value)){
			passConfirm.setCustomValidity("Missing a number");
		}
		else if(!spc.test(password.value)){
			passConfirm.setCustomValidity("Missing a special character");
		}
		else
		{
			passConfirm.setCustomValidity("");
		}
		
		if(reason === null || reason === "")
		{
			reason.setCustomValidity("Please provide a reason for your request!");
		}else
		{
			reason.setCustomValidity("");
		}
	},500);
}

password.onkeyup = validate();
passConfirm.onkeyup = validate();
reason.onkeyup = validate();