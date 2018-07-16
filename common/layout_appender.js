const debug = require('debug')('log4js:layout-appender');
/*  
This module is an appender for log4js.
The idea is that any logEvent passed in here will have the layout
applied to it, then it will be passed to another appender.
This is so that multiprocess can send a log event that actually
uses a layout. This allows layouts to be used with appenders that lack
said feature.
*/

function layoutAppender(appender, layout, timezoneOffset){
    const app = function(loggingEvent){
        let new_msg = loggingEvent.data;
        if(layout){
            new_msg = layout(loggingEvent, timezoneOffset);
        }

        loggingEvent.data = [new_msg];
        appender(loggingEvent);
    }
    //Don't know if this shutdown function is necessary.
    app.shutdown = function(complete) {}

    return app;
}

function configure(config, layouts, findAppender, levels) {
    let appender;
    let layout;

    if(!config.appender) throw new Error('No appender specified!');
    
    appender = findAppender(config.appender);
    
    if(config.layout){
        debug('Using passed layout!');
        layout = layouts.layout(config.layout.type, config.layout, config.timezoneOffset);
    }

    return layoutAppender(appender, layout, config.timezoneOffset);
}

module.exports.configure = configure;
