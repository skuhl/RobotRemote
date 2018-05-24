var password = document.getElementById('password');
var passConfirm = document.getElementById('REpassword');

function validate()
{
	if(password.value != passConfirm.value)
	{
		passConfirm.setCustomValidity("Passwords don't match!");
	}
	else
	{
		passConfirm.setCustomValidity("");
	}
}

password.onchange = validate;
passConfirm.onkeyup = validate;