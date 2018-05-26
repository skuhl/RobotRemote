var mouse_down = false;

const time_quantum = 30; /*Time quantum in minutes */
const num_days = 7; /*Number of days to display*/
const my_slot_request_color = '#1c22ea';
const my_slot_accepted_color = '#23ea1c';
const other_slot_requested_color = '#fcf802';
const other_slot_accepted_color = '#ea1c1c';
const cur_selection_color = '#fca801';

const day_index_to_string = {
    0: "Sun",
    1: "Mon",
    2: "Tues",
    3: "Wed",
    4: "Thurs",
    5: "Fri",
    6: "Sat"
}

const month_index_to_string = {
    0: "Jan",
    1: "Feb",
    2: "Mar",
    3: "Apr",
    4: "May",
    5: "Jun",
    6: "Jul",
    7: "Aug",
    8: "Sept",
    9: "Oct",
    10: "Nov",
    11: "Dec"
}

var GenerateGrid = function(elements){
    let num_columns = num_days;
    let num_rows = (24*60)/time_quantum;
    let start_time = Date.now();
    let start_date = new Date(start_time);
    var start_day_date = new Date(start_date.getFullYear(), start_date.getMonth(), start_date.getDay());
    var html = '<table><tr>'
    var i, j;
    //Generate days
    for(i = 0; i < num_days; i++){
        html += '<th><span>' + day_index_to_string[start_date.getDay()] +
        '</span><span>' + month_index_to_string[start_date.getMonth()] + 
        '</span><span>' + start_date.getDate() + '</span></th>'; 
    }

    html += '</tr>';

    //Generate elements for dates 
    for( i = 0; i < num_rows; i++){
        html += '<tr>';
        for(j = 0; j < num_columns; j++){
            var table_class = '';
            var row_date = new Date(start_day_date.getTime() + i*time_quantum*60*1000);
            print(row_date);
            var my_json = elements.mine.find(function(x){return row_date >= x.start_date && row_date <= x.end_date});
            var other_json = elements.others.find(function(x){return row_date >= x.start_date && row_date <= x.end_date});
            
            if(my_json !== undefined){
                table_class = my_json.accepted ? 'td_accepted' : 'td_pending';
            }else if(other_json !== undefined){
                table_class = other_json.accepted ? 'td_other_accepted' : 'td_other_pending';
            }
            html += '<td class="'+ table_class + '" onclick="GridMouseDown(this)" onmouseover="GridMouseOver(this)">';
            html += ((row_date.getHours()%12)+1) + ':' + row_date.getMinutes(); 
            html += '</td>';
        }
        html += '</tr>';
    }
    html += '<table>';

    document.getElementsByTagName("body")[0].innerHTML += html;

    console.log(html);
}

var GridMouseDown = function(element){
    console.log(element);
}

var GridMouseOver = function(element){

}

var req = new XMLHttpRequest();

req.onreadystatechange = function(){
    if(req.readyState === 4 && req.status === 200){
        var i;
        var res = JSON.parse(req.response);
        console.log(req.response);

        //Parse into more easily digestable format
        for(i = 0; i < res.mine.length; i++){
            res.mine[i].start_date = new Date(res.mine[i].starttime);
            res.mine[i].end_date = new Date((new Date(res.mine[i].starttime)).value +
                res.mine[i].duration*1000);
        }

        for(i = 0; i < res.others.length; i++){
            res.others[i].start_date = new Date(res.others[i].starttime);
            res.others[i].end_date = new Date((new Date(res.others[i].starttime)).value +
                res.others[i].duration*1000);
        }

        GenerateGrid(res);
    }else if(req.readyState === 4){
        console.log('Error getting timeslot requests.');
    }
}

req.open("GET", 'http://' + window.location.host + "/timeslotrequests", true);
req.send();