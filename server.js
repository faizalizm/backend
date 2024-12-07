const dotenv = require('dotenv').config();

const app = require('./app');
const {logger} = require('./services/logger');

const port = process.env.PORT || 3001;

app.listen(port, () => {
    logger.info(`App running on port ${port}`);
});