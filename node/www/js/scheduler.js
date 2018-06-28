var mouse_down = false;
var mode = null;
var max_quantums = 4;

var select_begin_index = -1;
var select_end_index = -1;

var time_quantum = 30; /*Time quantum in minutes */
var num_days = 7; /*Number of days to display*/

function loader(){
    var time = (Math.random() * 100) + 150;
    window.setTimeout(function(){
        var loaded = document.getElementById("table_content").getBoundingClientRect();
        if(!loaded.width){ //if the table width is 0 wait some more
            console.log(loaded.width);
            loader();
        }else{ //if the table width is non zero make it show up!
				document.getElementById("loader").classname = ('shrinking-cog');
				document.getElementById("loader").style.display = "none";	
        }
        
    },time);
}

var GenerateTable = function(my_elements){
    var html = '';
    
    if(my_elements.length == 0) document.getElementById('my_req_table').style.display = "none";

    for(var i = 0; i < my_elements.length; i++){
        let start = my_elements[i].start_date;
        let end = my_elements[i].end_date;
        html+='<tr id="request_table_row_'+ my_elements[i].id +'"class="request_table_row request_table_element">';
        //TODO pretty print dates?
        html+='<td class="request_table_element request_table_cell">' + DateTimeBeautify(start) +'</td>';
        
        html+='<td class="request_table_element request_table_cell">' + DateTimeBeautify(end) +'</td>';
        
        html+='<td class="request_table_element request_table_cell">' + (my_elements[i].approved ? "Yes" : "Awaiting") + '</td>';
        html+='<td class="request_table_element request_table_cell"><button class="delete_button" onclick="DeleteTimeslot(' + my_elements[i].id + ');">Delete</button></td>';
        html+='</tr>';
    }

    document.getElementById('my_req_table').innerHTML += html;
}

var DeleteTimeslot = function(id){
    console.log('Deleting ' + id);
    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function(){
        if(this.readyState === 4 && this.status === 200){
            var elem = document.getElementById('request_table_row_' + id);
            var parent = elem.parentElement;
            parent.removeChild(elem);
            //TODO remove table if no more elements in it.
            console.log("Deleted " + id);
            location.reload();
        }else if(this.readyState === 4){
            console.log('Error, couldn\'t delete!');
            console.log(this.responseText);
        }
    }

    xhr.open("GET", 'http://' + window.location.host + "/deletetimeslot/" + id, true);
    xhr.send();
}

var GenerateGrid = function(elements){
	 let earliest_start = 8*60*60*1000; // 8am earliest time to get the bot
    let end_time_hours = 16.5;				// 5pm is the latest we want people able to schedule
    let num_columns = num_days;
    let num_rows = (9*60)/time_quantum; // 8-5 is the 9 hour period of time when the bot may be used
    
    let start_time = Date.now();
    
    let start_date = new Date(start_time); 	 		// get today's date
    start_date.setDate(start_date.getDate() + 1);  // make it start on the next day

    if(start_date.getHours() >= end_time_hours){ 			// if it's past 5 start another day ahead
    	 start_date.setDate(start_date.getDate() + 1);
    	 start_date.setHours(0);
    }
    var start_day_date = new Date(start_date.getFullYear(), start_date.getMonth(), start_date.getDate());
    var html = '<table id="schedule_table" class="schedule_table_element" onmouseleave="TableLeave(this)" onmouseup="TableMouseUp(this)" ><tr class="schedule_table_element schedule_table_row">'
    var i, j;
    //Generate days (headers)
    for(i = 0; i < num_days; i++){
        var col_date = new Date(start_day_date.getTime() + i*24*60*60*1000);
        html += '<th class="schedule_table_element schedule_table_cell"><span class="block">' + day_index_to_string[col_date.getDay()] +
        '</span><span class="block">' + month_index_to_string[col_date.getMonth()] + 
        '</span><span class="block">' + col_date.getDate() + '</span></th>'; 
    }

    html += '</tr>';

    //Generate elements for dates (table cells) 
    for( i = 0; i < num_rows; i++){
        html += '<tr class="schedule_table_element schedule_table_row">';
        for(j = 0; j < num_columns; j++){
            var table_class = '';
            //row date = start_day + j days + i time quantums. 24*60*60*1000 = 1 day in ms
            
            var element_date = new Date(start_day_date.getTime() + earliest_start + j*24*60*60*1000 + i*time_quantum*60*1000);
            var my_json = elements.mine.find(function(x){return element_date >= x.start_date && element_date <= x.end_date});
            var other_json = elements.others.find(function(x){return element_date >= x.start_date && element_date <= x.end_date});
            var can_select = true;

            if(my_json !== undefined){
                table_class = my_json.accepted ? 'td_accepted' : 'td_pending';
                //Can't select them if they are already ours.
                can_select = false;
            }else if(other_json !== undefined){
                table_class = other_json.accepted ? 'td_other_accepted' : 'td_other_pending';
                can_select = !other_json.accepted;
            }

            if(element_date < start_date){
                can_select = false;
            }
            //can't select a time on the weekend
            if(element_date.getDay() == 0 || element_date.getDay() == 6){
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
            
            if(!(element_date.getDay() == 0 || element_date.getDay() == 6)) 
            	html += TimeBeautify(element_date); 
            html += '</td>';
        }
        html += '</tr>';
    }
    html += '</table>';

    document.getElementById('table_content').innerHTML += html;
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

var SubmitSelected = function(){
    
    if(select_begin_index == -1 || select_end_index == -1){
        alert("You need to select a time frame to request first!");
        return;
    }

    var xhr = new XMLHttpRequest();
    //Time since UTC epoch, in ms
    var begin_utc_time = new Date(document.getElementById('schedule-'+select_begin_index).getAttribute('date')).getTime();
    //selected duration, in ms
    var duration = (select_end_index - select_begin_index + 1) * time_quantum * 60 * 1000;

    xhr.onreadystatechange = function(){
        if(this.readyState === 4 && this.status === 200){
            alert("Successfully requested time slot!");
            //Update table (or remake it, or something)
            console.log('Success!');
            //reload the page becuase the table is updated
            location.reload();
        }else if(this.readyState === 4){
            alert("Error submitting time slot request! \n" + this.responseText);
        }
			//re enables the button(disabled somewhere else)
        if(this.readyState === 4){
            //I don't know why, but this doesn't work if it's too quick.
            setTimeout(function(){
                document.getElementById('req_submit').disabled = false;
            }, 1000);
        }
    }

    xhr.open("POST",location.protocol + '//' + window.location.host +  '/requesttimeslot', true);
    xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
    document.getElementById('req_submit').disabled = true;
    xhr.send(JSON.stringify({start_time: begin_utc_time, duration: duration}));
}

var req = new XMLHttpRequest();

req.onreadystatechange = function(){
    if(this.readyState === 4 && this.status === 200){
        var i;
        var res = JSON.parse(this.response);

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
        GenerateTable(res.mine);
        GenerateGrid(res);
    }else if(this.readyState === 4){
        console.log('Error getting timeslot requests.');
        console.log(this.responseText);
    }
}

req.open("GET", location.protocol + '//' + window.location.host + "/timeslotrequests", true);
req.send();