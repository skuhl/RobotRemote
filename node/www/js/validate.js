var form = document.forms.signup;
var password = form.elements.password;
var passConfirm = form.elements.REpassword;
var email = form.elements.username;
var reason = form.elements.reason;
/*
email.addEventListener("keyup", function(event){
	if(!email.validity.valid){
		email.setCustomValidity("Email format nonstandard!");
	}
	else{
		email.setCustomValidity("");
	}

},false);*/

passConfirm.addEventListener("keyup", function(event){
	//Check that the passwords match
	if(password.value != passConfirm.value)
	{
		console.log('SetCustomValidity');
		event.target.setCustomValidity("Passwords don't match!");
	}else
	{
		event.target.setCustomValidity("");
	}
});

reason.addEventListener("keyup", function(event){
	if(reason === null || reason === "")
	{
		reason.setCustomValidity("Please provide a reason for your request!");
	}else
	{
		reason.setCustomValidity("");
	}
});
/*
function validate()
{

	console.log('validate called');
	//Regular expression checks for email in format " "@" "." "
	var n = email.search(/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/);
	//might need to be less than one?
	if(n < 0)
	{
		email.setCustomValidity("Email format nonstandard!");
	}else
	{
		email.setCustomValidity("");
	}
	
	//Check that the passwords match
	if(password.value != passConfirm.value)
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
}*/

email.onchange = validate;
password.onchange = validate;
passConfirm.onkeyup = validate;
reason.onchange= validate;