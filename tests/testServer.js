const dotenv = require('dotenv').config();
const app = require('../app');
const http = require('http');

const server = http.createServer(app);

module.exports = server; // Export only for testing