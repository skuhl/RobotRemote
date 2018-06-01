let login_elements = {};
let timeslot_elements = {};

function GenerateTimeslotTable(timeslots){
    var table = document.createElement('table');
    table.classList.add("admin_timeslot_req_table");

    table.appendChild(CreateTableRow([
        "Email",
        "Start",
        "End",
        "Accept",
        "Reject"
    ]), true);
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
            '<button onclick="AcceptTimeslot(' + timeslots[i].id + ')">Accept</button>',
            '<button onclick="RejectTimeslot(' + timeslots[i].id + ')">Reject</button>'          
        ]);
        table.appendChild(row);
        timeslot_elements[timeslots[i].id] = row;
    }

    return table;
}

function GenerateLoginTable(logins){
    var table = document.createElement('table');
    table.classList.add("admin_login_req_table");
    //Table headers
    table.appendChild(CreateTableRow([
        "Email",
        "Reason",
        "Request Time",
        "Accept",
        "Reject"
    ]), true);

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
            '<button onclick="AcceptLogin(' + logins[i].id + ')">Accept</button>',
            '<button onclick="RejectLogin(' + logins[i].id + ')">Reject</button>'
        ]);
        table.appendChild(row);
        login_elements[logins[i].id] = row;
    }

    return table;
}

function RejectLogin(login_id){

}

function AcceptLogin(login_id){

}

function RejectTimeslot(timeslot_id){

}

function AcceptTimeslot(timeslot_id){
    
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

        document.getElementsByTagName('body')[0].appendChild(GenerateTimeslotTable(json.unapproved));
    }else if(this.readyState === 4){
        //failed
        alert('Couldn\'t get timeslots! <br/> ' + this.responseText);
    }
};

timeslot_xhr.open("GET", location.protocol + '//' + window.location.host + "/admin/timeslotrequests");
timeslot_xhr.send();

login_xhr.onreadystatechange = function(){
    if(this.readyState === 4 && this.status === 200){
        let json = JSON.parse(this.responseText);
        console.log(json);
        document.getElementsByTagName('body')[0].appendChild(GenerateLoginTable(json.requests));
    }else if(this.readyState === 4){
        //failed
        alert('Couldn\'t get pending login requests! <br/> ' + this.responseText);
    }
}

login_xhr.open("GET", location.protocol + '//' + window.location.host + "/admin/loginrequests");
login_xhr.send();