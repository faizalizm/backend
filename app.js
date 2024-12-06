const cors = require('cors');
const morgan = require('morgan');
const express = require('express');
const colors = require('colors');

const errorHandler = require('./middleware/errorMiddleware');
const connectDB = require('./services/mongodb');
const logger = require('./services/logger');

const swaggerUI = require('swagger-ui-express');
const swaggerSpec = require('./swagger/swagger');


// ------ Database Connection
connectDB();
console.log("Current Date and Time:", new Date());
console.log("Local Time:", new Date().toLocaleString());

// ------ Middleware
const app = express();
app.use(cors());
app.use(morgan('combined', {stream: process.stdout}));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use((req, res, next) => {
    logger.info({
        message: 'Incoming Request',
        body: req.body,
        params: req.params,
        query: req.query
    });
    next();
});

// ------ Routes
//app.use('/', swaggerUI.serve, swaggerUI.setup(swaggerSpec));
app.use('/api/v1/member', require('./routes/memberRoutes'));
app.use('/api/v1/package', require('./routes/packageRoutes'));
app.use('/api/v1/wallet', require('./routes/walletRoutes'));

app.use((req, res, next) => {
    const startTime = Date.now(); // Track request start time

    logger.info({
        message: 'Outgoing Response',
        body: res.body,
        params: res.params,
        query: res.query
    });

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info({
            message: 'Outgoing Response',
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`
        });
    });

    next();
});
app.use(errorHandler);

module.exports = app;