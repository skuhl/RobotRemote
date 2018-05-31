var form = document.forms.signup;
var password = form.elements.password;
var passConfirm = form.elements.REpassword;
var email = form.elements.username;
var reason = form.elements.reason;

function validate()
{
	//Check that the passwords match
	if(password != passConfirm)
	{
		console.log('SetCustomValidity');
		passConfirm.setCustomValidity("Passwords don't match!");
	}else
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
}

email.onchange = validate;
password.onchange = validate;
passConfirm.onkeyup = validate;
reason.onchange= validate;