var password = document.getElementById('password');
var passConfirm = document.getElementById('REpassword');

function validate()
{
	console.log('validate called');
	if(password.value != passConfirm.value)
	{
		console.log('SetCustomValidity');
		passConfirm.setCustomValidity("Passwords don't match!");
	}
	else
	{
		passConfirm.setCustomValidity("");
	}
}

password.onchange = validate;
passConfirm.onkeyup = validate;