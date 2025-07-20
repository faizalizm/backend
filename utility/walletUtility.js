
const { logger } = require('../services/logger');
const bcrypt = require('bcryptjs');

// Enterprise-grade: work factor of 12 (increase for slower hashing)
const WORK_FACTOR = 12;

const hashPIN = (plainPIN) => {
    if (!/^\d{6}$/.test(plainPIN)) {
        throw new Error('PIN must be exactly 6 digits');
    }
    return bcrypt.hash(plainPIN, WORK_FACTOR);
};

const verifyPIN = (plainPIN, hashedPIN) => {
    return bcrypt.compare(plainPIN, hashedPIN);
};

const handleIncorrectPIN = ({ wallet, configurations, member }) => {
    const maxTries = configurations.payments.pinTries;

    wallet.pinTries = (wallet.pinTries || 0) + 1;

    if (wallet.pinTries >= maxTries) {
        logger.warn(`PIN locked due to too many attempts - Member RefCode : ${member.referralCode}`);
        wallet.isWalletLocked = true;
        wallet.save();
        throw new Error('PIN has been locked due to too many failed attempts. Please contact support.');
    }

    wallet.save();
    const remaining = maxTries - wallet.pinTries;

    logger.warn(`Invalid PIN attempt - Member RefCode: ${member.referralCode}, Attempt ${wallet.pinTries}`);
    throw new Error(`Incorrect PIN entered, you have ${remaining} attempt(s) before lockout`);

};


const isWalletLocked = (wallet, configurations) => {
    return wallet.isWalletLocked || (wallet.pinTries > configurations.payments.pinTries);
};

const requirePin = (wallet, configurations, amount) => {
    if (wallet.minPinPrompt != null) {
        logger.info(`Wallet minPinPrompt is set: ${wallet.minPinPrompt}`);
        const result = amount >= wallet.minPinPrompt;
        logger.info(`Amount: ${amount} ${result ? '>=' : '<'} wallet.minPinPrompt: ${wallet.minPinPrompt}`);
        return result;
    }

    const result = amount >= configurations.payments.defaultPinPrompt;
    logger.info(`Wallet minPinPrompt not set, fallback to config`);
    logger.info(`Amount: ${amount} ${result ? '>=' : '<'} defaultPinPrompt: ${configurations.payments.defaultPinPrompt}`);
    return result;
};

module.exports = {
    hashPIN,
    verifyPIN,
    handleIncorrectPIN,
    isWalletLocked,
    requirePin
};