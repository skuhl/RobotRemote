function validate()
{
	var password = document.getElementById('password');
	var passConfirm = document.getElementById('REpassword');

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
confirm_password.onkeyup = validate;