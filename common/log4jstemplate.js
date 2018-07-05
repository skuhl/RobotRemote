let base_dir_name = __dirname.split('/').slice(0, -1).reduce((acc, x) => acc + '/' + x) + '/';
//Gets the stack using the V8 API.
function getStack(){
    let orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function(_, stack){
        return stack;
    }
    let err = new Error();
    Error.stackTraceLimit = 20;
    Error.captureStackTrace(err);
    let stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
}
//Functions for getting tokens. This might need some tweaking (12 stack frames deep might not be consistent)
function getLogFileName(logEvent){
    let file_path = getStack()[11].getFileName();
    return file_path.slice(base_dir_name.length);
}

function getLogLineNumber(logEvent){
    return getStack()[11].getLineNumber();
}

module.exports = {
    type: 'pattern',
    pattern: '[%d] [%p] %x{file}:%x{line}: %m',
    tokens: {
        file: getLogFileName,
        line: getLogLineNumber
    }
}
