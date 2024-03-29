const fs = require('fs');

const header_file = __dirname + '/www/Header.html'
const navbar_file = __dirname + '/www/Navbar.html'

function get_navbar(session, remove_banner){
    if(remove_banner === undefined) remove_banner = false;
    if(session && session.loggedin){
        return (remove_banner ? '' : `
        <div id="Navbar">
	        <h1 class="Title">
	            <span class="Main">Robot Run</span>
	            <span class="Sub">Robot Remote</span>
	            <img id="logo-print" src="/img/black.png" alt="Michigan Technological University print logo">
	        </h1>
        </div>`) +
        `<ul>
            <li><a href="/Home.html">Information</a></li>
            <li><a href="/Scheduler.html">Scheduler</a></li>
            <li><a href="/ControlPanel.html">Control Panel</a></li>
            ${session.is_admin ? '<li style="float:right"><a href="/admin/Admin.html">Admin</a></li>' : ''}
            <li style="float:right"><a href="/Logout">Logout</a></li>
        </ul>
        `;
    }else{
        return (remove_banner ? '' : `
        <div id="Navbar">
	        <h1 class="Title">
	            <span class="Main">Robot Run</span>
	            <span class="Sub">Robot Remote</span>
	            <img id="logo-print" src="/img/black.png" alt="Michigan Technological University print logo">
	        </h1>
        </div>`) +
        `
        <ul>
            <li><a href="/Home.html">Information</a></li>
            <li style="float:right"><a href="/Request.html">Sign Up</a></li>
            <li style="float:right"><a href="/Login.html">Login</a></li>
        </ul>
        `;
    }
}

/* 
    file: the main HTML page to compose.
    options: an object, containing the following options:
        beforeHeader
        afterHeader
        afterNavbar
        beforeFooter
        afterFooter
    All options are optional callback functions which return
    HTML strings, which are placed exactly where they sound like
    they are placed.
    There is also an option for removing the banner
        removeBanner
    Setting this to true will remove the banner from the top
    of the navbar. Defaults to false.
*/
module.exports = function (file, req, options){
    let HTMLstring = '<!doctype html><head>';
    if(options && options.beforeHeader) HTMLstring += options.beforeHeader();
    HTMLstring += fs.readFileSync(header_file, {encoding: 'utf8'});
    if(options && options.afterHeader) HTMLstring += options.afterHeader();
    HTMLstring += '</head><body>'
    //HTMLstring += fs.readFileSync(navbar_file, {encoding: 'utf8'});
    HTMLstring += get_navbar(req.session, options ? options.removeBanner : false);
    if(options && options.afterNavbar) HTMLstring += options.afterNavbar();
    HTMLstring += fs.readFileSync(file, {encoding: 'utf8'});
    HTMLstring += '</body><footer>'
    if(options && options.beforeFooter) HTMLstring += options.beforeFooter();
    /* PUT FOOTER STUFF HERE */
    if(options && options.afterFooter) HTMLstring += options.afterFooter();
    HTMLstring += '</footer>'

    return HTMLstring;
}
