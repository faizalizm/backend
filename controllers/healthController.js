const asyncHandler = require('express-async-handler');
const os = require('os');

const {logger} = require('../services/logger');

// Convert uptime (in seconds) to a human-readable string (e.g., "1d 2h 15m 30s")
const getReadableUptime = () => {
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / (3600 * 24));
    const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

// Convert bytes to megabytes (MB) with two decimal points
const getReadableMemory = (bytes) => {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getHealth = asyncHandler(async (req, res) => {

    logger.info('Fetching memory usage');
    const memUsage = process.memoryUsage();

    logger.info('Fetching cpu information');
    const cpus = os.cpus().map(cpu => ({
            model: cpu.model,
            speed: `${cpu.speed} MHz`
        }));

    const healthData = {
        uptimeSeconds: process.uptime(), // uptime in seconds
        uptime: getReadableUptime(), // human-readable uptime
        memoryUsage: {// memory usage in MB
            rss: getReadableMemory(memUsage.rss),
            heapTotal: getReadableMemory(memUsage.heapTotal),
            heapUsed: getReadableMemory(memUsage.heapUsed),
            external: getReadableMemory(memUsage.external),
            arrayBuffers: getReadableMemory(memUsage.arrayBuffers)
        },
        loadAverage: os.loadavg(), // system load averages [1, 5, 15] minutes
        totalMemory: getReadableMemory(os.totalmem()), // total system memory in MB
        freeMemory: getReadableMemory(os.freemem()), // free memory in MB
        cpuUsage: process.cpuUsage(), // CPU usage in microseconds since process start
        // platform: os.platform(), // e.g., 'linux'
        // osRelease: os.release(), // OS version
        // cpus: cpus, // array of CPU info (model and speed)
        // networkInterfaces: os.networkInterfaces(), // network interfaces and addresses
        // timestamp: new Date().toISOString()             // current timestamp
    };

    logger.info(`Health Data : ${JSON.stringify(healthData, null, 8)}`);
    res.status(200).json(healthData);
});

module.exports = {getHealth};
