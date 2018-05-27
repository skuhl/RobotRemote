var mouse_down = false;
var mode = null;
var max_quantums = 24;

var select_begin_index = -1;
var select_end_index = -1;

var time_quantum = 30; /*Time quantum in minutes */
var num_days = 14; /*Number of days to display*/

var day_index_to_string = {
    0: "Sun",
    1: "Mon",
    2: "Tues",
    3: "Wed",
    4: "Thurs",
    5: "Fri",
    6: "Sat"
}

var month_index_to_string = {
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

function Hour24To12(hour){
    if(hour == 0) return 12;
    if(hour > 12) return hour % 12;
    return hour;
}

var GenerateGrid = function(elements){
    let num_columns = num_days;
    let num_rows = (24*60)/time_quantum;
    let start_time = Date.now();
    let start_date = new Date(start_time);
    var start_day_date = new Date(start_date.getFullYear(), start_date.getMonth(), start_date.getDate());
    var html = '<table id="schedule_table" class="schedule_table_element" onmouseleave="TableLeave(this)" onmouseup="TableMouseUp(this)" ><tr class="schedule_table_element schedule_table_row">'
    var i, j;
    //Generate days
    for(i = 0; i < num_days; i++){
        var col_date = new Date(start_day_date.getTime() + i*24*60*60*1000);
        html += '<th class="schedule_table_element schedule_table_cell"><span class="block">' + day_index_to_string[col_date.getDay()] +
        '</span><span class="block">' + month_index_to_string[col_date.getMonth()] + 
        '</span><span class="block">' + col_date.getDate() + '</span></th>'; 
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
            var can_select = true;

            if(my_json !== undefined){
                table_class = my_json.accepted ? 'td_accepted' : 'td_pending';
                can_select = !my_json.accepted;
            }else if(other_json !== undefined){
                table_class = other_json.accepted ? 'td_other_accepted' : 'td_other_pending';
                can_select = !other_json.accepted;
            }
            if(element_date < start_date){
                can_select = false;
            }

            html += '<td id = "schedule-' +
                    (j*num_rows + i) +
                    '" class="' + 
                    table_class + 
                    ' schedule_table_element schedule_table_cell" date="' + 
                    element_date.toISOString() +
                    '" index="' + 
                    (j*num_rows + i) + 
                    '" can_select="' +
                    can_select +
                    '" onmousedown="GridMouseDown(this)" onmouseover="GridMouseOver(this)">';
            if(element_date >= start_date) html += PadNumber(2, '0', Hour24To12(element_date.getHours()%12), 0) + ':' + PadNumber(2, '0', element_date.getMinutes(), 0); 
            html += '</td>';
        }
        html += '</tr>';
    }
    html += '<table>';

    document.getElementsByTagName("body")[0].innerHTML += html;
}

function SelectElement(element){
    element.setAttribute('old_class', element.getAttribute('class'));
    element.setAttribute('class', "td_selected schedule_table_element schedule_table_cell");
}

function DeselectElement(element){
    element.setAttribute('class', element.getAttribute('old_class'));
}

var GridMouseDown = function(element){

    mouse_down = true;

    var index = Number.parseInt(element.getAttribute('index'));
    
    if(index == select_end_index){
        //Deselect
        select_end_index-=1;
        if(select_end_index < select_begin_index){
            select_begin_index = select_end_index = -1;
        }
        mode = 'deselect';
        DeselectElement(element);
    }else if(index == select_begin_index){
        //Deslect
        select_begin_index+=1;
        if(select_end_index < select_begin_index){
            select_begin_index = select_end_index = -1;
        }
        mode = 'deselect';
        DeselectElement(element);
    }else if(select_begin_index < 0 || select_end_index < 0){
        //select
        if(element.getAttribute('can_select') == 'false') return;
        select_begin_index = select_end_index = index;
        mode = 'select';
        SelectElement(element);
    }else if(select_begin_index - 1 == index){
        //select
        if((select_end_index - select_begin_index + 1) >= max_quantums || element.getAttribute('can_select') == 'false'){
            return;
        }
        select_begin_index -= 1;
        mode = 'select';
        SelectElement(element);
    }else if(select_end_index + 1 == index){
        //select
        if((select_end_index - select_begin_index + 1) >= max_quantums || element.getAttribute('can_select') == 'false'){
            return;
        }
        select_end_index += 1;
        mode = 'select';
        SelectElement(element);
    }
}

var GridMouseOver = function(element){
    var index = Number.parseInt(element.getAttribute('index'));
    if(mouse_down){
        if(mode == 'select'){
            if(select_begin_index < 0 || select_end_index < 0){
                //select
                if(element.getAttribute('can_select') == 'false') return;
                select_begin_index = select_end_index = index;
                SelectElement(element);
            }else if(select_begin_index - 1 == index){
                //select
                if((select_end_index - select_begin_index + 1) >= max_quantums || element.getAttribute('can_select') == 'false'){
                    return;
                }
                select_begin_index -= 1;
                SelectElement(element);
            }else if(select_end_index + 1 == index){
                //select
                if((select_end_index - select_begin_index + 1) >= max_quantums || element.getAttribute('can_select') == 'false'){
                    return;
                }
                select_end_index += 1;
                SelectElement(element);
            }
        }else if(mode == 'deselect'){
            if(index == select_end_index){
                //Deselect
                select_end_index-=1;
                if(select_end_index < select_begin_index){
                    select_begin_index = select_end_index = -1;
                }
                DeselectElement(element);
            }else if(index == select_begin_index){
                //Deslect
                select_begin_index+=1;
                if(select_end_index < select_begin_index){
                    select_begin_index = select_end_index = -1;
                }
                DeselectElement(element);
            }
        }
    }
}

var TableMouseUp = function(table){
    mouse_down = false;
}

var TableLeave = function(table) {
    mouse_down = false;
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