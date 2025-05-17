const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const morgan = require('morgan');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const colors = require('colors');

const errorHandler = require('./middleware/errorMiddleware');
const { connectDB } = require('./services/mongodb');
const { connectFirebase } = require('./services/firebaseCloudMessage');
const { logger, trimBase64 } = require('./services/logger');

const swaggerUI = require('swagger-ui-express');
const swaggerSpec = require('./swagger/swagger');

// ------ Database Connection
connectDB();

// ------ Firebase Connection
connectFirebase();

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

// ------ CSP
app.use(helmet());
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "https://code.jquery.com", // jQuery
                "https://cdn.jsdelivr.net", // CDN for other dependencies
                "https://stackpath.bootstrapcdn.com", // Bootstrap CDN
            ],
            styleSrc: [
                "'self'",
                "https://stackpath.bootstrapcdn.com", // Bootstrap styles
                "'unsafe-inline'", // Allow inline styles only if needed
            ],
            fontSrc: [
                "'self'",
                "https://fonts.googleapis.com",
                "https://fonts.gstatic.com", // Google Fonts
                "data:"
            ],
            imgSrc: ["'self'", "data:"], // Allow images from the same origin and data URIs
            connectSrc: ["'self'"], // Only allow connections to the same origin
            childSrc: ["'none'"], // Prevent embedding this site in an iframe
            frameAncestors: ["'none'"], // Prevent the site from being embedded into an iframe
            objectSrc: ["'none'"], // Block Flash and other plugins
            upgradeInsecureRequests: [], // Upgrade HTTP to HTTPS
        },
    })
);

app.use(compression()); // apply response compression
app.set('trust proxy', true); // trust nginx proxy

app.use((req, res, next) => {
    req.requestId = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-character ID
    logger.defaultMeta = { requestId: req.requestId };
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

app.use((req, res, next) => {
    const oldSend = res.send;

    res.send = function (body) {
        res.body = body; // Store body for logging
        res.set('Content-Length', Buffer.byteLength(body)); // Set actual content-length
        return oldSend.call(this, body); // Send response
    };

    next();
});

const requestFormat = (tokens, req, res) => {
    const method = tokens.method(req, res);
    const url = tokens.url(req, res);
    const ip = req.ip;
    const body = JSON.stringify(req.body);
    const params = JSON.stringify(req.params);
    const query = JSON.stringify(req.query);

    return `${colors.cyan(method)} ${colors.cyan(url)} | IP ${colors.magenta(ip)} | Body: ${colors.green(body)} | Params: ${colors.green(params)} | Query: ${colors.green(query)}`;
};

const responseFormat = (tokens, req, res) => {
    const method = tokens.method(req, res);
    const url = tokens.url(req, res);
    const ip = req.ip;
    let body = res.body || '';
    if (body.length > 1000) {
        body = body.slice(0, 1000) + '...'; // Add ellipsis to indicate trimming
    }
    const status = tokens.status(req, res);
    const contentLength = Buffer.byteLength(body).toString();
    const responseTime = Math.trunc(tokens['response-time'](req, res));

    return `${colors.cyan(method)} ${colors.cyan(url)} | IP ${colors.magenta(ip)} | HTTP ${colors.green(status)} | ${colors.yellow(contentLength + ' B')} | ${colors.red(responseTime)} ms | Body: ${colors.green(body)}`;
};

// Use morgan with fixed formats
app.use(morgan(requestFormat, {
    immediate: true,
    stream: {
        write: (message) => {
            process.stdout.write(message);
            logger.info(message.trim());
        }
    }
}));  // Log requests immediately
app.use(morgan(responseFormat, {
    stream: {
        write: (message) => {
            process.stdout.write(message);
            logger.info(message.trim());
        }
    }
}));  // Log responses after completion

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

app.use('/api/v1/advert', require('./routes/advertRoutes'));
app.use('/api/v1/banner', require('./routes/bannerRoutes'));
app.use('/api/v1/lifestyle', require('./routes/lifestyleRoutes'));

app.use('/api/v1/system', require('./routes/systemRoutes'));

app.use(errorHandler);

module.exports = app;