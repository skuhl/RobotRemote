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
    var start_day_date = new Date(start_date.getFullYear(), start_date.getMonth(), start_date.getDay());
    var html = '<table id="schedule_table" class="schedule_table_element"><tr class="schedule_table_element schedule_table_row">'
    var i, j;
    //Generate days
    for(i = 0; i < num_days; i++){
        html += '<th class="schedule_table_element schedule_table_cell"><span>' + day_index_to_string[start_date.getDay()] +
        '</span><span>' + month_index_to_string[start_date.getMonth()] + 
        '</span><span>' + start_date.getDate() + '</span></th>'; 
    }

    html += '</tr>';

    //Generate elements for dates 
    for( i = 0; i < num_rows; i++){
        html += '<tr class="schedule_table_element schedule_table_row">';
        for(j = 0; j < num_columns; j++){
            var table_class = '';
            var row_date = new Date(start_day_date.getTime() + i*time_quantum*60*1000);
            var my_json = elements.mine.find(function(x){return row_date >= x.start_date && row_date <= x.end_date});
            var other_json = elements.others.find(function(x){return row_date >= x.start_date && row_date <= x.end_date});
            
            if(my_json !== undefined){
                table_class = my_json.accepted ? 'td_accepted' : 'td_pending';
            }else if(other_json !== undefined){
                table_class = other_json.accepted ? 'td_other_accepted' : 'td_other_pending';
            }
            html += '<td class="'+ table_class + ' schedule_table_element schedule_table_cell" onclick="GridMouseDown(this)" onmouseover="GridMouseOver(this)">';
            html += PadNumber(2, '0', (row_date.getHours()%12)+1, 0) + ':' + PadNumber(2, '0', row_date.getMinutes(), 0); 
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