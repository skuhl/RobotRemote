let time_quantum = 30; /*Time quantum in minutes */
let num_days = 7; /*Number of days to display*/
let earliest_start = 8; //This is the earliest time (in hours)
let end_time_hours = 16.5; // 5pm is the latest we want people able to schedule
let lead_time_hours = 24; // Hours that you need to schedule in advance (Needs to be at least 24 hours in advance)
let skip_weekends = true; // Weekends are invalid
let start_end_tz = -5; // Time offset (in hours) from GMT for the above to start/end times to refer to.
//This is EST currently.
let start_end_tz_use_dst = true; // Does the above time offset use DST during certain parts of the year?
let dst_start_date = function(){ // What date/time starts DST? (current year, in GMT)
    //In the US, DST occurs during the second sunday of march, at 2AM
    let now = new Date();
    //Add in the timezone offset
    now = new Date(now.getTime() + start_end_tz * 60 * 60 * 1000);
    //First day of march, 2AM. This is in UTC, but we are assuming this is in the
    //given timezone. We will subtract it later.
    let start_date = new Date(Date.UTC(now.getFullYear(), 2, 0, 2, 0, 0, 0));
    //Get the first sunday
    while(start_date.getDay() != 0){
        start_date.setDate(start_date.getDate() + 1);
    }
    //Offset to second sunday, one week from the first sunday
    start_date.setDate(start_date.getDate() + 7);
    //Undo the implicit timezone offset above.
    start_date = new Date(start_date.getTime() - start_end_tz * 60 * 60 * 1000);

    return start_date;
}

let dst_end_date = function(){ // What date/time ends DST? (current year)
    //In the US, this is the first sunday of november, at 2AM
    let now = new Date();
    //Add in the timezone offset
    now = new Date(now.getTime() + start_end_tz * 60 * 60 * 1000);
    //First day of november, 2AM. This is in UTC, but we are assuming this is in the
    //given timezone. We will subtract it later.
    let start_date = new Date(Date.UTC(now.getFullYear(), 10, 0, 2, 0, 0, 0));
    //Get the first sunday
    while(start_date.getDay() != 0){
        start_date.setDate(start_date.getDate() + 1);
    }

    //Undo the implicit timezone offset above.
    start_date = new Date(start_date.getTime() - start_end_tz * 60 * 60 * 1000);

    return start_date;
}

function getHoursOnly(hours){
    return Math.floor(hours);
}

function getMinutesOnly(hours){
    return (hours - Math.floor(hours)) * 60;
}
//Gets earliest time to start on the given date.
//time in GMT for the earliest start.
let earliest_start_GMT = function(date){
    let new_date = new Date(date.getTime());
    if(!start_end_tz_use_dst){
        new_date.setUTCHours(getHoursOnly(earliest_start) - start_end_tz);
        new_date.setUTCMinutes(getMinutesOnly(earliest_start));
        new_date.setUTCSeconds(0);
        new_date.setUTCMilliseconds(0);
        return new_date;
    } 
    
    let dst_start = dst_start_date();
    let dst_end = dst_end_date();
    if(new_date >= dst_start && new_date <= dst_end){
        new_date.setUTCHours(getHoursOnly(earliest_start) - start_end_tz - 1);
        new_date.setUTCMinutes(getMinutesOnly(earliest_start));
        new_date.setUTCSeconds(0);
        new_date.setUTCMilliseconds(0);
    }else{
        new_date.setUTCHours(getHoursOnly(earliest_start) - start_end_tz);
        new_date.setUTCMinutes(getMinutesOnly(earliest_start));
        new_date.setUTCSeconds(0);
        new_date.setUTCMilliseconds(0);
    }
    return new_date;
}

//Get the end time for the given date.
let end_time_GMT = function(date){
    let new_date = new Date(date.getTime());
    if(!start_end_tz_use_dst){
        new_date.setUTCHours(getHoursOnly(end_time_hours) - start_end_tz);
        new_date.setUTCMinutes(getMinutesOnly(end_time_hours));
        new_date.setUTCSeconds(0);
        new_date.setUTCMilliseconds(0);
        return new_date;
    } 
    
    let dst_start = dst_start_date();
    let dst_end = dst_end_date();
    if(new_date >= dst_start && new_date <= dst_end){
        new_date.setUTCHours(getHoursOnly(end_time_hours) - start_end_tz - 1);
        new_date.setUTCMinutes(getMinutesOnly(end_time_hours));
        new_date.setUTCSeconds(0);
        new_date.setUTCMilliseconds(0);
    }else{
        new_date.setUTCHours(getHoursOnly(end_time_hours) - start_end_tz);
        new_date.setUTCMinutes(getMinutesOnly(end_time_hours));
        new_date.setUTCSeconds(0);
        new_date.setUTCMilliseconds(0);
    }
    return new_date;
}

function isValidDate(date){
    let sched_start = new Date(Date.now() + lead_time_hours * 60 * 60 * 1000);

    if(date.getDay() == 0 || date.getDay() == 6) return false;
    if(date < sched_start) return false;

    if(date >= earliest_start_GMT(date) && date <= end_time_GMT(date)){
        return true;
    }
    return false;
}

function GenerateGrid(elements){
    let num_columns = num_days;
    let num_rows = (((end_time_hours - earliest_start)*60)/time_quantum) + 1;
    let start_date = new Date(); 	 		// get today's date

    let start_day_date = new Date(start_date.getFullYear(), start_date.getMonth(), start_date.getDate());
    //let html = '<table id="schedule_table" class="schedule_table_element" onmouseleave="TableLeave(this)" onmouseup="TableMouseUp(this)" ><tr class="schedule_table_element schedule_table_row">'
    let i, j;
    //Grid, in column major order. That means it's ordered such that grid[0][1] Gets the cell at the first column, second row.
    let grid = [];
    //Generate days (headers)
    for(i = 0; i < num_days; i++){
        grid.push([]);
        for(j = 0; j < num_rows; j++){
            //row date = start_day + hour to start at + i days + j time quantums - . 24*60*60*1000 = 1 day in ms
            let row_date = new Date(start_day_date.getTime() + earliest_start*60*60*1000 + i*24*60*60*1000 + j*time_quantum*60*1000);
            let my_json = elements.mine.find(function(x){return row_date >= x.start_date && row_date <= x.end_date});
            let other_json = elements.others.find(function(x){return row_date >= x.start_date && row_date <= x.end_date});
            let table_class = '';
            let can_select = true;

            if(my_json !== undefined){
                table_class = my_json.accepted ? 'td_accepted' : 'td_pending';
                //Can't select them if they are already ours.
                can_select = false;
            }else if(other_json !== undefined){
                table_class = other_json.accepted ? 'td_other_accepted' : 'td_other_pending';
                can_select = !other_json.accepted;
            }
            if(isValidDate(row_date)){
                grid[i].push({time: row_date, class: table_class, selectable: can_select, index: num_rows*i + j + i});
            }
            /* Above, you can see the index is calculated with a '+ i' tacked onto the end. This is important! This leaves a one index gap between days.
               This means that only timeslots on the same day can be selected.
            */
        }
    }
/*
    //Trim columns that have invalid dates in them
    for(i = grid.length - 1; i >= 0; i--){
        let valid_col = grid[i].reduce((acc, x) => typeof acc !== 'boolean' ? isValidDate(acc.time) || isValidDate(x.time) : acc || isValidDate(x.time));
        if(valid_col === false){
            grid.splice(i, 1);
        }
    }
*/
  return grid;
}

module.exports.GenerateGrid = GenerateGrid;
