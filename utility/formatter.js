const moment = require('moment-timezone');

const formatAmount = (amount) => {
    if (typeof amount !== 'number') {
        throw new Error('Amount must be a number');
    }
    return `RM ${(amount / 100).toFixed(2)}`;
}

const formatTimestamp = (date) => {
    if (!date) return undefined;

    const timezone = process.env.TIMEZONE || 'Asia/Kuala_Lumpur';
    const format = process.env.TIMESTAMP_FORMAT_DISPLAY || 'YYYY-MM-DD HH:mm:ss';

    return moment(date).tz(timezone).format(format);
};

module.exports = {
    formatAmount,
    formatTimestamp
};

