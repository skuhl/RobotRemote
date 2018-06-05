var form = document.forms.signup;
var password = form.elements.password.value;
var passConfirm = form.elements.REpassword.value;
var reason = form.elements.reason;

function validate()
{
	//Check that the passwords match
	if(password != passConfirm)
	{
		passConfirm.setCustomValidity("Passwords don't match!");
	}else if(password.length < 8 || password.length > 22){
		password.setCustomValidity("Password should be 8-22 characters");
	}else if(!password.includes(/([A-Z])/g)){
		passConfirm.setCustomValidity("Missing a capital letter");
	}
	else if(!password.includes(/([a-z])/g)){
		passConfirm.setCustomValidity("Missing a lower case letter");
	}
	else if(!password.includes(/([0-9])/g)){
		passConfirm.setCustomValidity("Missing a number");
	}
	else if(!password.includes(/([0-9])/g)){//some range of special characters
		passConfirm.setCustomValidity("Missing a number");
	}
	else
	{
		passConfirm.setCustomValidity("");
	}
	
	if(password)
	
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