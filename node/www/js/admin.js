let login_elements = {};
let timeslot_elements = {};

function GenerateTimeslotTable(timeslots){
    
    if(timeslots.length <= 0) return null;

    var table = document.createElement('table');
    table.classList.add("admin_timeslot_req_table");
	 
    table.appendChild(CreateTableRow([
        "Email",
        "Start",
        "End",
        "",
        ""
    ], "admin_timeslot_", true));
    //Generate table rows
    for(var i = 0; i < timeslots.length; i++){
        var row = CreateTableRow([
            timeslots[i].email,
            "<span class='block'>" + 
                DateBeautify(timeslots[i].start_date) +
                '</span><span class="block">' +
                TimeBeautify(timeslots[i].start_date) +
            "</span>",
            "<span class='block'>" + 
                DateBeautify(timeslots[i].end_date) +
                '</span><span class="block">' +
                TimeBeautify(timeslots[i].end_date) +
            "</span>",
            '<button class="admin_button" onclick="AcceptTimeslot(' + timeslots[i].id + ')">Accept</button>',
            '<button class="admin_button" onclick="RejectTimeslot(' + timeslots[i].id + ')">Reject</button>'          
        ], "admin_timeslot_");
        table.appendChild(row);
        timeslot_elements[timeslots[i].id] = row;
    }

    return table;
}

function GenerateLoginTable(logins){
    
    if(logins.length <= 0) return null;
    
    var table = document.createElement('table');
    table.classList.add("admin_login_req_table");
    //Table headers
    table.appendChild(CreateTableRow([
        "Email",
        "Reason",
        "Request Time",
        "",
        ""
    ], "admin_login_", true));

    //Generate table rows
    for(var i = 0; i < logins.length; i++){
        var row = CreateTableRow([
            logins[i].email,
            logins[i].reason,
            "<span class='block'>" + 
                DateBeautify(new Date(logins[i].date_requested)) +
                '</span><span class="block">' +
                TimeBeautify(new Date(logins[i].date_requested)) +
            "</span>",
            '<button class="admin_button" onclick="AcceptLogin(' + logins[i].id + ')">Accept</button>',
            '<button class="admin_button" onclick="RejectLogin(' + logins[i].id + ')">Reject</button>'
        ], "admin_login_");
        table.appendChild(row);
        login_elements[logins[i].id] = row;
    }
    return table;
}

function RejectLogin(login_id){
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
        if(this.readyState === 4 && this.status === 200){
            RemoveLoginFromTable(login_id);
            alert("Succesfully rejected login!");
        }else if(this.readyState === 4){
            alert("Couldn't reject login: \n " + this.responseText);
        }
    }

    xhr.open("GET", location.protocol + '//' + window.location.host + "/admin/rejectloginrequest/" + login_id);
    xhr.send();
}

function AcceptLogin(login_id){
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
        if(this.readyState === 4 && this.status === 200){
            RemoveLoginFromTable(login_id);
            alert("Successfully accepted login!");
        }else if(this.readyState === 4){
            alert("Could not accept login: \n" + this.responseText);
        }
    }

    xhr.open("GET", location.protocol + '//' + window.location.host + "/admin/acceptloginrequest/" + login_id);
    xhr.send();
}

function RejectTimeslot(timeslot_id){
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
        if(this.readyState === 4 && this.status === 200){
            RemoveTimeslotFromTable(timeslot_id);
            alert("Successfully rejected time slot!");
        }else if(this.readyState === 4){
            alert("Couldn't reject time slot: \n " + this.responseText);
        }
    }

    xhr.open("GET", location.protocol + '//' + window.location.host + "/admin/rejecttimeslotrequest/" + timeslot_id);
    xhr.send();
}

function AcceptTimeslot(timeslot_id){
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
        if(this.readyState === 4 && this.status === 200){
            RemoveTimeslotFromTable(timeslot_id);
            alert("Successfully accepted time slot!");
        }else if(this.readyState === 4){
            alert("Couldn't accept time slot \n" + this.responseText);
        }
    }

    xhr.open("GET", location.protocol + '//' + window.location.host + "/admin/accepttimeslotrequest/" + timeslot_id);
    xhr.send();
}

function RemoveLoginFromTable(login_id){
    var parent = login_elements[login_id].parentElement;
    parent.removeChild(login_elements[login_id]);
    login_elements[login_id] = undefined;

    if(Object.keys(login_elements).length == 0){
        parent.parentElement.removeChild(parent);
    }
}

function RemoveTimeslotFromTable(timeslot_id){
    var parent = timeslot_elements[timeslot_id].parentElement;
    parent.removeChild(timeslot_elements[timeslot_id]);
    timeslot_elements[timeslot_id] = undefined;

    if(Object.keys(timeslot_elements).length == 0){
        parent.parentElement.removeChild(parent);
    }
}

var timeslot_xhr = new XMLHttpRequest();
var login_xhr = new XMLHttpRequest();

timeslot_xhr.onreadystatechange = function(){
    if(this.readyState === 4 && this.status === 200){
        //success
        var i;
        console.log(this.responseText);
        let json = JSON.parse(this.responseText);
        //Convert relevent sent data to dates
        for(i = 0; i < json.approved.length; i++){
            json.approved[i].start_date = new Date(json.approved[i].starttime);
            json.approved[i].end_date = new Date(json.approved[i].start_date.getTime() + json.approved[i].duration * 1000);
        }
        
        for(i = 0; i < json.unapproved.length; i++){
            json.unapproved[i].start_date = new Date(json.unapproved[i].starttime);
            json.unapproved[i].end_date = new Date(json.unapproved[i].start_date.getTime() + json.unapproved[i].duration * 1000);
        }
        var timeslot_table = GenerateTimeslotTable(json.unapproved);
        if(timeslot_table != null) document.getElementById("timeslot_requests").appendChild(timeslot_table);
    
    }else if(this.readyState === 4){
        //failed
        alert('Couldn\'t get timeslots! \n ' + this.responseText);
    }
};

timeslot_xhr.open("GET", location.protocol + '//' + window.location.host + "/admin/timeslotrequests");
timeslot_xhr.send();

login_xhr.onreadystatechange = function(){
    if(this.readyState === 4 && this.status === 200){
        let json = JSON.parse(this.responseText);
        console.log(json);

        var login_table = GenerateLoginTable(json.requests);

        if(login_table != null) document.getElementById('login_requests').appendChild(login_table);
    
    }else if(this.readyState === 4){
        //failed
        alert('Couldn\'t get pending login requests! \n ' + this.responseText);
    }
}

login_xhr.open("GET", location.protocol + '//' + window.location.host + "/admin/loginrequests");
login_xhr.send();
