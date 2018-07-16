let base_dir_name = __dirname.split('/').slice(0, -1).reduce((acc, x) => acc + '/' + x) + '/';
//Gets the stack using the V8 API.
function getStack(){
    let orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function(_, stack){
        return stack;
    }
    let err = new Error();
    Error.stackTraceLimit = 25;
    Error.captureStackTrace(err);
    let stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
}

function getNonLog4jsStack(stack){
    for(let i = 2; i < stack.length; i++){
        if(stack[i] === null) return null;
        if(stack[i].getFileName() === null) continue;
        if(stack[i].getFileName().indexOf('/node_modules/log4js/') === -1 &&
           stack[i].getFileName().indexOf('/common/layout_appender.js') === -1) return stack[i];
    }
    return null;
}

//Functions for getting tokens. This might need some tweaking (12 stack frames deep might not be consistent)
function getLogFileName(logEvent){
    let stack_call = getNonLog4jsStack(getStack());
    if(stack_call === null) return 'unknown';
    let file_name = stack_call.getFileName();
    if(file_name == null) return 'unknown';
    if(file_name.startsWith('/')){
        return file_name.slice(base_dir_name.length);
    }else{
        return file_name;
    }
}

function getLogLineNumber(logEvent){
    let stack_call = getNonLog4jsStack(getStack());
    if(stack_call === null) return 'unknown';
    let line = stack_call.getLineNumber();
    if(line == null) return 'unknown'; 
    return line;
}

module.exports = {
    type: 'pattern',
    pattern: '[%d] (PID: %z) [%p] %x{file}:%x{line}: %m',
    tokens: {
        file: getLogFileName,
        line: getLogLineNumber
    }
}
