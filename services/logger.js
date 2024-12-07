const colors = require('colors');
const winston = require('winston');
require('winston-daily-rotate-file');

const trimBase64 = (result, maxLength = 50, visited = new Set()) => {
    const obj = result;
    if (obj && typeof obj === 'object') {
        // Check for circular references
        if (visited.has(obj)) {
            return '[Circular Reference]';
        }
        visited.add(obj); // Mark the current object as visited

        // Iterate over the object's properties
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                obj[key] = trimBase64(obj[key], maxLength, visited); // Recurse
            }
        }
    } else if (typeof obj === 'string' && obj.startsWith('data:image/')) {
        // Calculate base64 size in MB
        const base64Data = obj.split(',')[1]; // Remove prefix if present
        const byteSize = Buffer.byteLength(base64Data || '', 'base64');
        const sizeMB = (byteSize / (1024 * 1024)).toFixed(2);

        // Truncate base64 string and add a note that it's truncated
        return `${obj.slice(0, maxLength)}... [BASE64_TRUNCATED] (${sizeMB} MB)`;
    }
    return obj;
};


const customFormat = winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';

    return `${colors.cyan(`PROCESS ID: ${requestId || 'SYSTEM'}`)} ` + // Request ID in cyan
            `${colors.bold(`[${level.toUpperCase()}]`)} ` + // Log level in bold
            `${colors.yellow(`[${timestamp}]`)} ` + // Timestamp in yellow
            `- ${colors.green(message)} ${metaString}`;              // Message in green
});

// Add custom level colors
winston.addColors({
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue'
});

// Daily rotating file transport
const fileRotateTransport = new winston.transports.DailyRotateFile({
    filename: 'logs/application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: process.env.LOG_RETENTION_DAYS || '20d',
    zippedArchive: true
});

// Create Winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
            winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
            customFormat
            ),
    transports: [
//        new winston.transports.Console({
//            format: winston.format.combine(
//                    winston.format.colorize(),
//                    winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
//                    customFormat
//                    )
//        }),
        fileRotateTransport
    ],
});

module.exports = {logger, trimBase64};
