const fs = require('fs');

const header_file = __dirname + '/www/Header.html'
const navbar_file = __dirname + '/www/Navbar.html'
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
*/
/* TODO add footer file */
module.exports = function (file, options){
    let HTMLstring = '<!doctype html><head>';
    if(options && options.beforeHeader) HTMLstring += options.beforeHeader();
    HTMLstring += fs.readFileSync(header_file, {encoding: 'utf8'});
    if(options && options.afterHeader) HTMLstring += options.afterHeader();
    HTMLstring += '</head><body>'
    HTMLstring += fs.readFileSync(navbar_file, {encoding: 'utf8'});
    if(options && options.afterNavbar) HTMLstring += options.afterNavbar();
    HTMLstring += fs.readFileSync(file, {encoding: 'utf8'});
    HTMLstring += '</body><footer>'
    if(options && options.beforeFooter) HTMLstring += options.beforeFooter();
    /* PUT FOOTER STUFF HERE */
    if(options && options.afterFooter) HTMLstring += options.afterFooter();
    HTMLstring += '</footer>'
}