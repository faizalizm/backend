
const { logger } = require('../services/logger');
const bcrypt = require('bcryptjs');

// Enterprise-grade: work factor of 12 (increase for slower hashing)
const WORK_FACTOR = 12;

const hashPIN = async (plainPIN) => {
    if (!/^\d{6}$/.test(plainPIN)) {
        throw new Error('PIN must be exactly 6 digits');
    }
    return await bcrypt.hash(plainPIN, WORK_FACTOR);
};

const verifyPIN = async (plainPIN, hashedPIN) => {
    return await bcrypt.compare(plainPIN, hashedPIN);
};

const handleIncorrectPIN = async ({ wallet, configurations, member }) => {
    const maxTries = configurations.payments.pinTries;

    wallet.pinTries = (wallet.pinTries || 0) + 1;

    if (wallet.pinTries >= maxTries) {
        logger.warn(`PIN locked due to too many attempts - Member RefCode : ${member.referralCode}`);
        wallet.isWalletLocked = true;
        await wallet.save();
        throw new Error('PIN has been locked due to too many failed attempts. Please contact support.');
    }

    await wallet.save();
    const remaining = maxTries - wallet.pinTries;

    logger.warn(`Invalid PIN attempt - Member RefCode: ${member.referralCode}, Attempt ${wallet.pinTries}`);
    throw new Error(`Incorrect PIN entered, you have ${remaining} attempt(s) before lockout`);

};


const verifyWallet = async (wallet, configurations) => {
    return wallet.isWalletLocked || (wallet.pinTries > configurations.payments.pinTries);
};

module.exports = {
    hashPIN,
    verifyPIN,
    handleIncorrectPIN,
    verifyWallet
};