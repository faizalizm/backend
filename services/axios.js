const axios = require('axios');

const {logger} = require('./logger');

// Create an Axios instance
const axiosInstance = axios.create();

// Request Interceptor
axiosInstance.interceptors.request.use((config) => {
    logger.info('Sending Axios Request', {
        url: config.url,
        method: config.method,
        headers: config.headers,
        params: config.params,
        data: config.data
    });
    return config;
}, (error) => {
    logger.error('Request Error:', error);
    return Promise.reject(error);
});

// Response Interceptor
axiosInstance.interceptors.response.use((response) => {
    logger.info('Receiving Axios Response:', {
        url: response.config.url,
        status: response.status,
        data: response.data
    });
    return response;
}, (error) => {
    logger.error('Response Error:', {
        message: error.message,
        response: error.response ? {
            url: error.response.config.url,
            status: error.response.status,
            data: error.response.data
        } : null
    });
    return Promise.reject(error);
});

module.exports = axiosInstance;