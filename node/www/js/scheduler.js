var mouse_down = false;
var mode = null;

var max_quantums = 4;
var select_begin_index = -1;
var select_end_index = -1;
//Generates scheduler table.
//Returns element for the generated table. 
function GetTableHTML(times){
    var html = document.createElement('table');
    var i, j;
    html.classList.add('schedule_table_element');
    html.id = 'schedule_table';
    html.appendChild(CreateTableRow([], 'schedule_table_', true));
    html.setAttribute('onmouseleave', 'TableLeave(this)');
    html.setAttribute('onmouseup', 'TableMouseUp(this)');
    //We sort these dates. The dates *SHOULD* be ordered when they are added
    //to the hidden element, but to ensure correctness, we sort.
    var dates = times
        .sort(function(a,b){
            a = new Date(a.time); 
            b = new Date(b.time);
            if(a < b) return -1; 
            else if (a > b) return 1; 
            return 0;
        });
    
    for(i = 0; i < dates.length; i++){
        dates[i].time = new Date(dates[i].time);
    }

    for(i = 0; i < dates.length; i++){
        var col = -1; 
        var header_row = html.children[0];
        //find the column to insert the given date into
        for(j = 0; j < header_row.children.length; j++){
            var element = header_row.children[j];
            var date = new Date(element.getAttribute('date'));
            if(DateCompare(date, dates[i].time) === 0){
                col = j;
                break;
            }
        }

        if(col === -1){
            //No column to put the date in, we need to create one
            var th = document.createElement('th');
            th.classList.add('schedule_table_element');
            th.classList.add('schedule_table_cell');
            th.innerHTML  = '<span class="block">' + day_index_to_string[dates[i].time.getDay()] +
            '</span><span class="block">' + month_index_to_string[dates[i].time.getMonth()] + 
            '</span><span class="block">' + dates[i].time.getDate() + '</span>';
            th.setAttribute('date', dates[i].time);
            html.children[0].appendChild(th);

            //Add the extra cell to every row
            for(j = 1; j < html.children.length; j++){
                var td = document.createElement('td');
                td.classList.add('schedule_table_element');
                td.classList.add('schedule_table_cell');
                td.setAttribute('can_select', 'false');
                td.setAttribute('onmousedown', 'GridMouseDown(this)');
                td.setAttribute('onmouseover', 'GridMouseOver(this)');
                html.children[j].appendChild(td);
            }
            col = html.children[0].children.length - 1;
        }

        //Find the row to insert the date into
        var row = -1;
        var found_row = false;
        var insertRowBefore = null; //null indicates that we append to the end of the list of rows
        for(j = 1; j < html.children.length; j++){
            date = new Date(html.children[j].getAttribute('date'));
            if(TimeCompare(dates[i].time, date) === 0){
                row = j;
                found_row = true;
                break;
            }else if(TimeCompare(dates[i].time, date) < 0){
                //This row comes after our row. So we should insert our row before this one.
                insertRowBefore = html.children[j];
                row = j; // When inserted, this date will go into row j
                break;
            }
        }

        if(!found_row){
            //Couldn't find the correct row, insert a new one.
            var tr = document.createElement('tr');
            tr.classList.add('schedule_table_element');
            tr.classList.add('schedule_table_row');
            tr.setAttribute('date', dates[i].time); // Only the time component is relevant here.
            //Add columns
            for(j = 0; j < header_row.children.length; j++){
                var td = document.createElement('td');
                td.classList.add('schedule_table_element');
                td.classList.add('schedule_table_cell');
                td.setAttribute('can_select', 'false');
                td.setAttribute('onmousedown', 'GridMouseDown(this)');
                td.setAttribute('onmouseover', 'GridMouseOver(this)');
                tr.appendChild(td);
            }

            if(insertRowBefore == null){
                html.appendChild(tr);
                row = html.children.length - 1; // Row we need to insert into is the last one.
            }else{
                html.insertBefore(tr, insertRowBefore);
            }
        };
        //insert the date into the td at row, col
        var my_element = html.children[row].children[col];
        my_element.setAttribute('can_select', dates[i].selectable);
        my_element.setAttribute('index', dates[i].index);
        if(typeof dates[i].class === 'string' && dates[i].class !== ''){
            my_element.classList.add(dates[i].class);
        }

        my_element.innerText = TimeBeautify(dates[i].time);

    }


    return html;
}

function loader(){
    var time = (Math.random() * 100) + 150;
    window.setTimeout(function(){
        var loaded = document.getElementById("table_content").getBoundingClientRect();
        if(!loaded.width){ //if the table width is 0 wait some more
            loader();
        }else{ //if the table width is non zero make it show up!
            document.getElementById("loader").classname = 'shrinking-cog';
            document.getElementById("loader").style.display = "none";
        }
        
    }, time);
}

var GenerateTable = function(my_elements){
    var html = '';
    
    if(my_elements.length == 0) document.getElementById('my_req_table').style.display = "none";

    for(var i = 0; i < my_elements.length; i++){
        let start = my_elements[i].start_date;
        let end = my_elements[i].end_date;
        html+='<tr id="request_table_row_'+ my_elements[i].id +'"class="request_table_row request_table_element">';
        
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
            console.log("SCHEDULER: Deleted " + id);
            location.reload();
        }else if(this.readyState === 4){
            console.error('SCHEDULER: Error, couldn\'t delete! \n' + this.responseText);
        }
    }

    xhr.open("GET", 'http://' + window.location.host + "/deletetimeslot/" + id, true);
    xhr.send();
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
    if(element.getAttribute('can_select') == 'false') return;

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
        select_begin_index = select_end_index = index;
        mode = 'select';
        SelectElement(element);
    }else if(select_begin_index - 1 == index){
        //select
        if((select_end_index - select_begin_index + 1) >= max_quantums){
            return;
        }
        select_begin_index -= 1;
        mode = 'select';
        SelectElement(element);
    }else if(select_end_index + 1 == index){
        //select
        if((select_end_index - select_begin_index + 1) >= max_quantums){
            return;
        }
        select_end_index += 1;
        mode = 'select';
        SelectElement(element);
    }
}

var GridMouseOver = function(element){
    if(element.getAttribute('can_select') == 'false') return;
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
                if((select_end_index - select_begin_index + 1) >= max_quantums){
                    return;
                }
                select_begin_index -= 1;
                SelectElement(element);
            }else if(select_end_index + 1 == index){
                //select
                if((select_end_index - select_begin_index + 1) >= max_quantums){
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
            console.log('SCHEDULER: Success!');
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

    xhr.open("POST", location.protocol + '//' + window.location.host +  '/requesttimeslot', true);
    xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
    document.getElementById('req_submit').disabled = true;
    xhr.send(JSON.stringify({start_time: begin_utc_time, duration: duration}));
}

var req = new XMLHttpRequest();
/*
req.onreadystatechange = function(){
    if(this.readyState === 4 && this.status === 200){
        var i;
        var res = JSON.parse(this.response);

        //Parse into more easily digestable format
        for(i = 0; i < res.mine.length; i++){
            res.mine[i].start_date = new Date(res.mine[i].starttime);
            res.mine[i].end_date = new Date((new Date(res.mine[i].starttime)).getTime() +
                res.mine[i].duration*1000);
            console.log("SCHEDULER: Starts: " + res.mine[i].start_date + ", Ends: " + res.mine[i].end_date);
        }

        for(i = 0; i < res.others.length; i++){
            res.others[i].start_date = new Date(res.others[i].starttime);
            res.others[i].end_date = new Date((new Date(res.others[i].starttime)).getTime() +
                res.others[i].duration*1000);
            console.log("SCHEDULER: Starts: " + res.others[i].start_date + ", Ends: " + res.others[i].end_date);
        }
        GenerateTable(res.mine);
        GenerateGrid(res);
    }else if(this.readyState === 4){
        console.error('SCHEDULER: Error getting timeslot requests.\n' + this.responseText);
    }
}

req.open("GET", location.protocol + '//' + window.location.host + "/timeslotrequests", true);
req.send();
*/
//Imediately and asynchronously execute the get table html function
setTimeout(function(){
    let table_div = document.getElementById('table_content');
    table_div.appendChild(GetTableHTML(JSON.parse(document.getElementById('grid-data').value)));
}, 0);
