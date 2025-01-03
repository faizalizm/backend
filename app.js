const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const morgan = require('morgan');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const colors = require('colors');
//const {v4: uuidv4} = require('uuid');

const errorHandler = require('./middleware/errorMiddleware');
const {connectDB} = require('./services/mongodb');
const {logger, trimBase64} = require('./services/logger');

const swaggerUI = require('swagger-ui-express');
const swaggerSpec = require('./swagger/swagger');

// ------ Database Connection
connectDB();

// ------ Middleware
console.log("Current Date and Time:", new Date());
console.log("Local Time:", new Date().toLocaleString());

const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(helmet()); // apply security headers
app.use(compression()); // apply response compression

app.use((req, res, next) => {
    req.requestId = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-character ID
    logger.defaultMeta = {requestId: req.requestId};
    next();
});

app.use((req, res, next) => { // Store Express res for Morgan usage
    const originalSend = res.send.bind(res);

    res.send = (body) => {
        if (typeof body === 'object') {
            // If the body is an object, stringify it first
            body = JSON.stringify(body);
        }
        res.body = body;  // Capture response body
        originalSend(body);  // Send the response as usual
    };
    next();
});
const requestFormat = (tokens, req, res) => {
    const requestId = req.requestId;
    const method = tokens.method(req, res);
    const url = tokens.url(req, res);
    const timestamp = new Date().toISOString();
    const ip = req.ip;
    const body = JSON.stringify(req.body);
    const params = JSON.stringify(req.params);
    const query = JSON.stringify(req.query);

    return `${colors.bold(`[REQUEST ID: ${requestId}]`)} ${colors.cyan(method)} ${colors.green(url)} | Timestamp: ${colors.yellow(timestamp)} | IP ${colors.magenta(ip)} | Body: ${colors.yellow(body)} | Params: ${colors.magenta(params)} | Query: ${colors.blue(query)}`;
};

const responseFormat = (tokens, req, res) => {
    const requestId = req.requestId;
    const method = tokens.method(req, res);
    const url = tokens.url(req, res);
    const timestamp = new Date().toISOString();
    const ip = req.ip;
    let body = res.body || '';
    if (body.length > 1000) {
        body = body.slice(0, 1000) + '...'; // Add ellipsis to indicate trimming
    }
    const status = tokens.status(req, res);
    const contentLength = tokens.res(req, res, 'content-length') || '0';
    const responseTime = tokens['response-time'](req, res);

    return `${colors.bold(`[RESPONSE ID: ${requestId}]`)} ${colors.cyan(method)} ${colors.green(url)} | Timestamp: ${colors.yellow(timestamp)} | IP ${colors.magenta(ip)} | HTTP ${colors.green(status)} | ${colors.yellow(contentLength + ' B')} | ${colors.red(responseTime)} ms | Body: ${colors.yellow(body)}`;
};

// Use morgan with fixed formats
app.use(morgan(requestFormat, {immediate: true, stream: process.stdout}));  // Log requests immediately
app.use(morgan(responseFormat, {stream: process.stdout}));  // Log responses after completion

// ------ View Routes
app.get('/', (req, res) => {
    res.status(200).render('base');
});
app.get('/account/delete', (req, res) => {
    res.status(200).render('deleteAccount');
});

// ------ API Routes
//app.use('/', swaggerUI.serve, swaggerUI.setup(swaggerSpec));
app.use('/api/v1/member', require('./routes/memberRoutes'));
app.use('/api/v1/merchant', require('./routes/merchantRoutes'));
app.use('/api/v1/package', require('./routes/packageRoutes'));
app.use('/api/v1/wallet', require('./routes/walletRoutes'));
app.use('/api/v1/points', require('./routes/pointsRoutes'));
app.use('/api/v1/charity', require('./routes/charityRoutes'));


app.use(errorHandler);

module.exports = app;