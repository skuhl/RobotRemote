var mouse_down = false;

const time_quantum = 30; /*Time quantum in minutes */
const num_days = 7; /*Number of days to display*/

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
/*
Function which pads number to num_digits digits before the decimal point,
using the give padding character.
*/
function PadNumber(num_digits, padding_character, number, precision){
    var fixed_num_str = number.toFixed(precision);
    var cur_num_digits = fixed_num_str.indexOf('.');
    var num_padding_needed = cur_num_digits < 0 ? num_digits - fixed_num_str.length : num_digits - cur_num_digits;
    var final_string = fixed_num_str;
    var i;

    for(i = 0; i < num_padding_needed; i++){
        final_string = padding_character + final_string;
    } 

    return final_string;
}

var GenerateGrid = function(elements){
    let num_columns = num_days;
    let num_rows = (24*60)/time_quantum;
    let start_time = Date.now();
    let start_date = new Date(start_time);
    var start_day_date = new Date(start_date.getFullYear(), start_date.getMonth(), start_date.getDate());
    var html = '<table id="schedule_table" class="schedule_table_element"><tr class="schedule_table_element schedule_table_row">'
    var i, j;
    //Generate days
    for(i = 0; i < num_days; i++){
        var col_date = new Date(start_day_date.getTime() + i*24*60*60*1000);
        html += '<th class="schedule_table_element schedule_table_cell"><span>' + day_index_to_string[col_date.getDay()] +
        '</span><span>' + month_index_to_string[col_date.getMonth()] + 
        '</span><span>' + col_date.getDate() + '</span></th>'; 
    }

    html += '</tr>';

    //Generate elements for dates 
    for( i = 0; i < num_rows; i++){
        html += '<tr class="schedule_table_element schedule_table_row">';
        for(j = 0; j < num_columns; j++){
            var table_class = '';
            //row date = start_day + j days + i time quantums. 24*60*60*1000 = 1 day in ms
            var element_date = new Date(start_day_date.getTime() + j*24*60*60*1000 + i*time_quantum*60*1000);
            var my_json = elements.mine.find(function(x){return element_date >= x.start_date && element_date <= x.end_date});
            var other_json = elements.others.find(function(x){return element_date >= x.start_date && element_date <= x.end_date});
            
            if(my_json !== undefined){
                table_class = my_json.accepted ? 'td_accepted' : 'td_pending';
            }else if(other_json !== undefined){
                table_class = other_json.accepted ? 'td_other_accepted' : 'td_other_pending';
            }
            html += '<td class="'+ table_class + ' schedule_table_element schedule_table_cell" onclick="GridMouseDown(this)" onmouseover="GridMouseOver(this)">';
            html += PadNumber(2, '0', (element_date.getHours()%12)+1, 0) + ':' + PadNumber(2, '0', element_date.getMinutes(), 0); 
            html += '</td>';
        }
        html += '</tr>';
    }
    html += '<table>';

    document.getElementsByTagName("body")[0].innerHTML += html;
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

        //Parse into more easily digestable format
        for(i = 0; i < res.mine.length; i++){
            res.mine[i].start_date = new Date(res.mine[i].starttime);
            res.mine[i].end_date = new Date((new Date(res.mine[i].starttime)).getTime() +
                res.mine[i].duration*1000);
            console.log("Starts: " + res.mine[i].start_date + ", Ends: " + res.mine[i].end_date);
        }

        for(i = 0; i < res.others.length; i++){
            res.others[i].start_date = new Date(res.others[i].starttime);
            res.others[i].end_date = new Date((new Date(res.others[i].starttime)).getTime() +
                res.others[i].duration*1000);
            console.log("Starts: " + res.others[i].start_date + ", Ends: " + res.others[i].end_date);
        }

        GenerateGrid(res);
    }else if(req.readyState === 4){
        console.log('Error getting timeslot requests.');
    }
}

req.open("GET", 'http://' + window.location.host + "/timeslotrequests", true);
req.send();