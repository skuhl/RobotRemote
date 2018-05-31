var form = document.forms.signup;
var password = form.elements.password.value;
var passConfirm = form.elements.REpassword.value;
var email = form.elements.username.value;
var reason = form.elements.reason.value;

function validate()
{
	console.log('validate called');
	//Check that the passwords match
	if(password.value !== passConfirm.value)
	{
		console.log('SetCustomValidity');
		passConfirm.setCustomValidity("Passwords don't match!");
	}else
	{
		passConfirm.setCustomValidity("");
	}
	
	if(reason == null || reason == "")
	{
		reason.setCustomValidity("Please provide a reason for your request!");
	}else
	{
		reason.setCustomValidity("");
	}
}

email.onchange = validate;
password.onchange = validate;
passConfirm.onkeyup = validate;
reason.onchange= validate;