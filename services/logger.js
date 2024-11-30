const winston = require('winston');
require('winston-daily-rotate-file');

const fileRotateTransport = new winston.transports.DailyRotateFile({
    filename: 'logs/application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: process.env.LOG_RETENTION_DAYS || '20d',
    zippedArchive: true,
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
            winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
            winston.format.json() // JSON format for structured logging
            ),
    transports: [
        new winston.transports.Console({
            format: winston.format.printf((info) => {
                // Pretty print JSON logs for console
                return JSON.stringify(info, null, 8);
            }),
        }),
        fileRotateTransport,
    ],
});

module.exports = logger;
