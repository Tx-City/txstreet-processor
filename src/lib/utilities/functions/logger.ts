import moment from 'moment';

export enum LoggingLevel {
    Info = 1, 
    Warn = 2,
    Error = 4,
    None = Number.MAX_SAFE_INTEGER
}

var logLevel: LoggingLevel = LoggingLevel.Info;

const setLogLevel = (level: LoggingLevel) =>
    logLevel = level; 

const info = (...any: any[]) => {
    if(LoggingLevel.Info >= logLevel) {
        const timestamp = moment(Date.now()).format('MMMM Do YYYY, h:mm:ss a'); 
        console.log(`[INFO][${timestamp}]:`, ...any); 
    }
}

const warn = (...any: any[]) => {
    if(LoggingLevel.Warn >= logLevel) {
        const timestamp = moment(Date.now()).format('MMMM Do YYYY, h:mm:ss a'); 
        console.warn(`[WARN][${timestamp}]:`, ...any); 
    }
}

const error = (...any: any[]) => {
    if(LoggingLevel.Error >= logLevel) {
        const timestamp = moment(Date.now()).format('MMMM Do YYYY, h:mm:ss a'); 
        console.error(`[ERROR][${timestamp}]:`, ...any); 
    }
}

const print = (...any: any[]) => {
    const timestamp = moment(Date.now()).format('MMMM Do YYYY, h:mm:ss a'); 
    console.log(`[PRINT][${timestamp}]:`, ...any); 
}

export default { setLogLevel, info, warn, error, print, LoggingLevel };

