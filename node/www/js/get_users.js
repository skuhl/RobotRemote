let user_elements= {};

function GenerateUserTable(users){
	if(users.length <= 0) return null;
	
	var table = document.createElement('table');
	table.classList.add("user_table", "pagination");
	table.setAttribute("data-pagecount", "8");
	
	table.appendChild(CreateTableRow([
		"ID",
		"Admin",
		"Email",
		"",
		""
	], "user_table_", true));
		
	//generate table rows
	for(var i = 0; i < users.length; i++){
		
		var row = CreateTableRow([
			users[i].id,
			users[i].admin,
			users[i].email,
			'<button class="admin_button" onclick="RemoveUser(' + users[i].id + ')">Remove</button>',
			'<button class="admin_button" onclick="Adminify(' + users[i].id +', '+ users[i].admin + ')">Adminify</button>'
		], "user_table_", users[i].id);
		table.appendChild(row);
		user_elements[users[i].id] = row;
	}
	return table;
}

function RemoveUser(user_id){
	var xhr = new XMLHttpRequest();
	if (confirm("Are you sure you want to remove this user? You cannot undo this action.")) {
		xhr.onreadystatechange = function(){
			if(this.readyState === 4 && this.status === 200){
				RemoveUserFromTable(user_id);
				alert("Successfully removed user!");
			}else if(this.readyState === 4){
				alert("Could not remove user:" + this.responseText);
			}
		}
	}else
		return;
	xhr.open("GET", location.protocol + '//' + window.location.host + "/admin/removeuser/" + user_id);
	xhr.send();
}

function Adminify(user_id, is_admin){
	var xhr = new XMLHttpRequest();
	if (confirm("Are you sure you want to give or take admin privileges for this user?")) {
		xhr.onreadystatechange = function(){
			if(this.readyState === 4 && this.status === 200){
				alert("Admin status changed!");
			}else if(this.readyState === 4){
				alert("Could not change admin status:" + this.responseText);
			}
		}
	}else
		return;
	
	console.log(is_admin);
	if(is_admin != 1){
		xhr.open("GET", location.protocol + '//' + window.location.host + "/admin/adminify/" + user_id);
	}else{
		xhr.open("GET", location.protocol + '//' + window.location.host + "/admin/deAdminify/" + user_id);
	}
	xhr.send();
}

function RemoveUserFromTable(user_id){
    var parent = user_elements[user_id].parentElement;
    parent.removeChild(user_elements[user_id]);
    login_elements[user_id] = undefined;

    if(Object.keys(user_elements).length == 0){
        parent.parentElement.removeChild(parent);
	 }
}

var user_xhr = new XMLHttpRequest();

user_xhr.onreadystatechange = function(){
	if(this.readyState === 4 && this.status === 200){
        let json = JSON.parse(this.responseText);
        console.log(json);
        
        var user_table = GenerateUserTable(json.requests);
        if(user_table != null) document.getElementById('current_users').appendChild(user_table);
   
   }else if(this.readyState === 4){
   		//failed
   		alert('Could not get current users! <br/>' + this.responseText);
   }
}

user_xhr.open("GET", location.protocol + '//' + window.location.host + "/admin/currentusers");
user_xhr.send();
