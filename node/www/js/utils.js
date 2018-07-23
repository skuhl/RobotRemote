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
/* 
    Function to convert 24 hour, 0 based times (like Date.prototype.getHour)
    to it's corresponding 12 hour number.
*/
function Hour24To12(hour){
    if(hour == 0) return 12;
    if(hour > 12) return hour % 12;
    return hour;
}
/*
    Returns a string that displays the date (only the date part) 
    in a way that doesn't suck. (mm/dd/yyyy)
*/
function DateBeautify(date){
    return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
}
/* Returns a string that displays the time (only the time part)
   in a 12-hour format (hh:mm(PM|AM))
*/
function TimeBeautify(date){
    return PadNumber(2, '0', Hour24To12(date.getHours()), 0) + 
    ':' + 
    PadNumber(2, '0', date.getMinutes(), 0) + 
    ' ' +
    (date.getHours() < 12 ? 'AM' : 'PM');
}
/* Combines the 2 above into one function */
function DateTimeBeautify(date){
    return DateBeautify(date) + ' ' + TimeBeautify(date);
}
/*As the name implies, this creates an element with tagname, with the provided content inside as text.*/
function CreateElementWithText(tagname, content){
    var tag = document.createElement(tagname);
    return tag.appendChild(document.createTextNode(content));
}
/*This function creates a table row, using an array of inner HTML strings
  Returns an element that contains all inner htmls in their own td or th elements.
  is_header controls whether to use th or not. This is an optional argument.
  id is also an optional argument. If it's defined, it sets the ID's using it as a suffix.
  ID of a row = class_prefix + id
*/
function CreateTableRow(inner_htmls, class_prefix, is_header, id){
    
    if(is_header === undefined) is_header = false;
    if(class_prefix === undefined) class_prefix = 'table-'

    var tag_type = is_header ? 'th' : 'td';

    var tr = document.createElement('tr');
    
    tr.classList.add(class_prefix + 'row');

    if(id !== undefined) tr.id = (class_prefix + id);

    for(var i = 0; i < inner_htmls.length; i++){
        var td = document.createElement(tag_type);
        
        td.classList.add(class_prefix + 'element');
        td.classList.add(class_prefix + 'col-' + i);
        
        td.innerHTML = inner_htmls[i];
        tr.appendChild(td);
    }
    return tr;
}
//Comparator functions work like this: 
//Comparator(a,b): returns -1 if a < b, 0 if a=b, or 1 if a > b.

//Compare only the date components of 2 Date objects
function DateCompare(date1, date2){
    if(date1.getFullYear() < date2.getFullYear()) return -1
    if(date2.getFullYear() < date1.getFullYear()) return 1;
    if(date1.getMonth() < date2.getMonth()) return -1
    if(date2.getMonth() < date1.getMonth()) return 1;
    if(date1.getDate() < date2.getDate()) return -1
    if(date2.getDate() < date1.getDate()) return 1;
    return 0;
}

//Compare only the time component of 2 dates
function TimeCompare(date1, date2){
    if(date1.getHours() < date2.getHours()) return -1
    if(date2.getHours() < date1.getHours()) return 1;
    if(date1.getMinutes() < date2.getMinutes()) return -1
    if(date2.getMinutes() < date1.getMinutes()) return 1;
    if(date1.getSeconds() < date2.getSeconds()) return -1
    if(date2.getSeconds() < date1.getSeconds()) return 1;
    if(date1.getMilliseconds() < date2.getMilliseconds()) return -1
    if(date2.getMilliseconds() < date1.getMilliseconds()) return 1;
    return 0;
}


//If this is require'd from nodejs, export some functions.
if(typeof module === 'object'){
    module.exports.DateTimeBeautify = DateTimeBeautify;
    module.exports.DateBeautify = DateBeautify;
    module.exports.TimeBeautify = TimeBeautify;   
}
