const asyncHandler = require('express-async-handler');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');

const { logger } = require('../services/logger');
const { sendMail } = require('../services/nodemailer');
const { getCategoryToyyib, createBillToyyib, getBillTransactionsToyyib } = require('../services/toyyibpay');
const { buildTransferMessage, buildQRPaymentMessage, sendMessage } = require('../services/firebaseCloudMessage');

const { formatAmount } = require('../utility/formatter');
const { hashPIN, verifyPIN, handleIncorrectPIN, verifyWallet, requirePin } = require('../utility/walletUtility');

const Member = require('../models/memberModel');
const Wallet = require('../models/walletModel');
const Package = require('../models/packageModel');
const Transaction = require('../models/transactionModel');
const Merchant = require('../models/merchantModel');
const Configuration = require('../models/configurationModel');

const getWallet = asyncHandler(async (req, res) => {
    // Find the wallet linked to the member
    logger.info('Fetching wallet details');
    const wallet = await Wallet.findOne({ memberId: req.member._id });
    if (!wallet) {
        res.status(404);
        throw new Error('Wallet Not Found');
    }

    // Calculate the date 90 days ago
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Find all transactions linked to the wallet
    logger.info('Fetching points history - Status : Success / In Progress, 90d Ago : ' + ninetyDaysAgo);
    const transactions = await Transaction.find({
        $or: [
            // Withdrawals: Include 'Success' and 'In Progress'
            {
                $and: [
                    { description: 'Withdrawal' },
                    {
                        systemType: { $in: ['HubWallet', 'FPX'] },
                        walletId: wallet._id,
                        status: { $in: ['Success', 'In Progress'] },
                        createdAt: { $gte: ninetyDaysAgo }
                    }
                ]
            },
            // All other transactions: Only 'Success'
            {
                $and: [
                    { description: { $ne: 'Withdrawal' } },
                    {
                        systemType: { $in: ['HubWallet', 'FPX'] },
                        walletId: wallet._id,
                        status: 'Success',
                        createdAt: { $gte: ninetyDaysAgo }
                    }
                ]
            }
        ]
    }, {
        _id: 0,
        systemType: 1,
        type: 1,
        description: 1,
        status: 1,
        amount: 1,
        createdAt: 1,
        withdrawalDetails: 1,
        shippingStatus: 1,
        shippingDetails: 1
    }).sort({ createdAt: -1 });

    res.status(200).json({
        isPinSet: !!wallet.pin,
        balance: wallet.balance,
        points: wallet.points,
        currency: wallet.currency,
        minPinPrompt: wallet.minPinPrompt,
        transactions
    });
});


const topupWallet = asyncHandler(async (req, res) => {
    const { paymentChannel, amount } = req.body;

    const minTopupAmount = 1000;

    if (!paymentChannel || !amount) {
        res.status(400);
        throw new Error('Payment channel and amount are required');
    }

    logger.info(`Checking minimum topup - Amount : ${amount}, Minimum topup : ${minTopupAmount}`);
    if (amount < minTopupAmount) {
        res.status(400);
        throw new Error(`Topup amount must be at least ${formatAmount(minTopupAmount)}`);
    }

    if (paymentChannel !== 'FPX') {
        res.status(404);
        throw new Error('Payment channel not supported');
    }

    logger.info('Fetching topup package');
    const vipPackage = await Package.findOne(
        { type: 'Topup' },
        { name: 1, code: 1, categoryCode: 1, packageCharge: 1, emailContent: 1 }
    );

    if (!vipPackage) {
        res.status(500);
        throw new Error('Package not found');
    }
    logger.info(`Topup package - ${vipPackage.name}, Code : ${vipPackage.code}, Category Code : ${vipPackage.categoryCode}`);

    // Find the wallet linked to the member
    logger.info('Fetching wallet detail');
    const wallet = await Wallet.findOne({ memberId: req.member._id });
    if (!wallet) {
        res.status(500);
        throw new Error('Wallet Not Found');
    }

    logger.info('Fetching ToyyibPay category');
    const getCategory = await getCategoryToyyib(req, res, vipPackage.categoryCode);

    try {
        const billExpiryDate = moment().tz('Asia/Kuala_Lumpur').add(5, 'minutes').format('DD-MM-YYYY HH:mm:ss');

        // Create Transaction
        logger.info('Creating topup in progress transaction');
        const transaction = await Transaction.create({
            walletId: wallet._id,
            systemType: 'HubWallet',
            type: 'Credit',
            description: 'Top Up',
            status: 'In Progress',
            packageCode: vipPackage.code,
            amount: amount
        });

        if (!transaction) {
            res.status(500);
            throw new Error('Failed to create transaction, please try again later');
        }

        logger.info('Creating ToyyibPay Bill');
        const createBill = await createBillToyyib(req, res, amount, vipPackage, getCategory, billExpiryDate);
        const billCode = createBill.data[0].BillCode;
        const paymentUrl = process.env.TOYYIB_URL + '/' + billCode;

        // Update the transaction to include the BillCode
        await Transaction.findByIdAndUpdate(transaction._id, { billCode }, { new: true });

        // Query to ToyyibPay
        logger.info('Fetching ToyyibPay transaction status');
        getBillTransactionsToyyib(req.member._id, wallet._id, amount, billCode, "Top Up");

        // Return the response to the client
        res.status(200).json({ paymentUrl, paymentExpiry: billExpiryDate });

    } catch (error) {
        res.status(500);
        throw new Error('Topup failed, please try again later');
    }
});

const withdrawWallet = asyncHandler(async (req, res) => {
    const { withdrawChannel, amount } = req.body;

    const minWithdrawal = 1000;

    if (!amount || !withdrawChannel) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    if (amount <= 0) {
        res.status(400);
        throw new Error('Invalid withdrawal amount');
    }

    logger.info(`Checking minimum withdrawal - Amount : ${amount}, Minimum withdrawal : ${minWithdrawal}`);
    if (amount < minWithdrawal) {
        res.status(400);
        throw new Error(`Amount must be at least ${minWithdrawal}`);
    }

    // Find the wallet linked to the member
    logger.info('Fetching wallet details');
    const wallet = await Wallet.findOne({ memberId: req.member._id }, { paymentCode: 0 });
    if (!wallet) {
        res.status(404);
        throw new Error('Wallet Not Found');
    }

    const transactionData = {
        walletId: wallet._id,
        systemType: 'HubWallet',
        type: 'Debit',
        description: 'Withdrawal',
        status: 'In Progress',
        amount: amount,
        withdrawalDetails: {}
    };

    if (withdrawChannel === 'Bank') {
        const { bankDetails } = req.body;
        const { bankName, bankAccountName, bankAccountNumber } = bankDetails;
        if (!bankName || !bankAccountName || !bankAccountNumber) {
            res.status(400);
            throw new Error('Please provide all bank details');
        }

        if (!/^\d+$/.test(bankAccountNumber)) {
            res.status(400);
            throw new Error('Invalid bank account number format');
        }

        transactionData.withdrawalDetails.bankDetails = {
            bankName,
            bankAccountName,
            bankAccountNumber
        };

    } else {
        res.status(404);
        throw new Error('Withdraw channel not supported');
    }

    logger.info(`Wallet balance: ${wallet.balance}, Withdrawal amount: ${amount}`);
    // Check if wallet balance is sufficient for the withdrawal
    if (wallet.balance < amount) {
        res.status(402); // HTTP 402: Payment Required
        throw new Error('Insufficient funds');
    }

    try {
        transactionData.withdrawalDetails.type = withdrawChannel;
        logger.info('Creating wallet debit transaction');
        const transaction = await Transaction.create(transactionData);

        if (!transaction) {
            res.status(500);
            throw new Error('Failed to create transaction');
        }

        wallet.balance -= amount;
        await wallet.save();

        // Notify Admin (Asynchronously)
        logger.info('Sending withdrawal notification via email');
        sendWithdrawalNotification(req.member, transaction);

        res.status(200).json({
            balance: wallet.balance,
            currency: wallet.currency
        });
    } catch (error) {
        logger.error(`Error processing withdrawal : ${error.message}`);

        res.status(500);
        throw new Error('Withdrawal failed, please try again later');
    }
});

const transferVerification = asyncHandler(async (req, res) => {
    const { paymentCode, spendingCode, userName, email, phone } = req.body;

    let recipientWallet;
    let merchant;

    if (spendingCode) {
        logger.info('Merchant QR Payment');
        if (!spendingCode.startsWith('spend://')) {
            res.status(400);
            throw new Error('QR code is not valid');
        }

        logger.info('Fetching merchant details');
        merchant = await Merchant.findOne({ spendingCode }, { _id: 0, memberId: 1, name: 1, cashbackRate: 1 });
        if (!merchant) {
            res.status(404);
            throw new Error('Merchant not found');
        }
        logger.info(`Merchant - ${merchant.name}`);

        recipientWallet = await Wallet.findOne({ memberId: merchant.memberId });

        if (!recipientWallet) {
            res.status(404);
            throw new Error('Recipient not found');
        } else if (recipientWallet.memberId === req.member._id) {
            res.status(400);
            throw new Error('Could not transfer to your own account');
        }
    } else if (paymentCode) {
        logger.info('QR Transaction');
        if (!paymentCode.startsWith('payment://')) {
            res.status(400);
            throw new Error('QR code is not valid');
        }

        logger.info('Fetching recipient wallet details');
        recipientWallet = await Wallet.findOne({ paymentCode });

        if (!recipientWallet) {
            res.status(404);
            throw new Error('Recipient Not Found');
        } else if (recipientWallet.memberId === req.member._id) {
            res.status(400);
            throw new Error('Could not transfer to your own account');
        }
    } else {
        logger.info('Transfer via userName/email/phone');
        if (!userName && !email && !phone) {
            res.status(400)
            throw new Error('Recipient details required for transfer');
        }

        logger.info('Checking recipient is ownself');
        if ((email && email.trim() === req.member.email)
            || phone && phone.trim() === req.member.phone
            || userName && userName.trim() === req.member.userName) {
            res.status(400);
            throw new Error('Could not transfer to your own account');
        }
    }

    logger.info('Fetching recipient details');
    let recipient;
    if (paymentCode || spendingCode) {
        recipient = await Member.findOne({ _id: recipientWallet.memberId }, { fullName: 1, email: 1, phone: 1 });
    } else if (userName) {
        recipient = await Member.findOne({ userName }, { fullName: 1, email: 1, phone: 1 });
    } else if (email) {
        recipient = await Member.findOne({ email }, { fullName: 1, email: 1, phone: 1 });
    } else if (phone) {
        recipient = await Member.findOne({ phone }, { fullName: 1, email: 1, phone: 1 });
    }

    if (!recipient) {
        res.status(404);
        throw new Error('Recipient Not Found');
    } else if (spendingCode) {
        res.status(200).json({
            merchantLogo: merchant.logo,
            merchantName: merchant.name,
            cashbackRate: merchant.cashbackRate
        });
    } else {
        res.status(200).json({
            memberFullName: recipient.fullName
        });
    }
});

const transferWallet = asyncHandler(async (req, res) => {
    const { userName, email, phone, amount, walletPin } = req.body;

    if (!userName && !email && !phone) {
        res.status(400);
        throw new Error('Recipient details required for transfer');
    }

    if (!amount) {
        res.status(400);
        throw new Error('Amount is required');
    }

    if (email && email.trim() === req.member.email) {
        res.status(400);
        throw new Error('Could not transfer to your own account');
    }

    if (!req.member.userName && !req.member.fullName) {
        logger.warn('Sender has not set username or fullname');
        res.status(400);
        throw new Error('You have not completed your profile');
    }

    logger.info('Fetching recipient details');
    let method;
    let recipient;

    if (userName) {
        method = 'via Username';
        recipient = await Member.findOne({ userName }, { userName: 1, fullName: 1, email: 1, phone: 1 });
    } else if (phone) {
        method = 'via Phone';
        recipient = await Member.findOne({ phone }, { userName: 1, fullName: 1, email: 1, phone: 1 });
    } else if (email) {
        method = 'via Email';
        recipient = await Member.findOne({ email }, { userName: 1, fullName: 1, email: 1, phone: 1 });
    }

    if (!recipient) {
        res.status(404);
        throw new Error('Recipient Not Found');
    }

    if (!recipient.userName && !recipient.fullName) {
        logger.warn('Member has not set username or fullname');
        res.status(400);
        throw new Error('Member has not completed their profile');
    }

    const recipientDisplayName = recipient.userName || recipient.fullName;
    const senderDescription = `Transfer to ${recipientDisplayName} ${method}`

    const senderDisplayName = req.member.userName || req.member.fullName;
    const recipientDescription = `Received Transfer from ${senderDisplayName} ${method}`;

    logger.info('Fetching sender wallet details');
    const senderWallet = await Wallet.findOne({ memberId: req.member._id });
    if (!senderWallet) {
        res.status(404);
        throw new Error('Sender wallet not found');
    }

    logger.info('Fetching recipient wallet details');
    const recipientWallet = await Wallet.findOne({ memberId: recipient._id });
    if (!recipientWallet) {
        res.status(404);
        throw new Error('Recipient wallet not found');
    }

    // Check if wallet balance is sufficient for the withdrawal
    logger.info(`Checking wallet balance - Sender balance : RM ${senderWallet.balance / 100}, Transfer amount : RM ${amount / 100}`);
    if (senderWallet.balance < amount) {
        res.status(402); // HTTP 402: Payment Required
        throw new Error('Insufficient funds');
    }

    logger.info('Creating sender debit transaction');
    const senderTransaction = await Transaction.create({
        walletId: senderWallet._id,
        systemType: 'HubWallet',
        type: 'Debit',
        description: senderDescription,
        status: 'Success',
        counterpartyWalletId: recipientWallet._id,
        amount: amount
    });

    logger.info(`Recipient balance : RM ${recipientWallet.balance / 100}, Receiving amount : RM ${amount / 100}`);
    logger.info('Creating recipient credit transaction');
    const recipientTransaction = await Transaction.create({
        walletId: recipientWallet._id,
        systemType: 'HubWallet',
        type: 'Credit',
        description: recipientDescription,
        status: 'Success',
        counterpartyWalletId: senderWallet._id,
        amount: amount
    });

    if (senderTransaction && recipientTransaction) {

        logger.info('Deducting sender wallet balance');
        senderWallet.balance -= Number(amount);
        await senderWallet.save();

        logger.info('Adding recipient wallet balance');
        recipientWallet.balance += Number(amount);
        await recipientWallet.save();

        logger.info(`New Sender Balance: ${senderWallet.balance}`);
        logger.info(`New Recipient Balance: ${recipientWallet.balance}`);

        // Send FCM
        logger.info('Notifying recipient via FCM');
        const message = buildTransferMessage(amount, req.member);
        sendMessage(message, recipient);

        res.status(200).json({
            balance: senderWallet.balance,
            currency: senderWallet.currency
        });
    } else {
        res.status(500);
        throw new Error('Transfer failed, please try again later');
    }
});

const qrPayment = asyncHandler(async (req, res) => {
    const { paymentCode, amount, walletPin } = req.body;

    if (!paymentCode) {
        res.status(400);
        throw new Error('QR Payment Code is required');
    } else if (!amount) {
        res.status(400);
        throw new Error('Amount is required');
    }

    if (!paymentCode.startsWith('payment://')) {
        res.status(400);
        throw new Error('QR code is not valid');
    }

    logger.info('Fetching sender wallet details');
    const senderWallet = await Wallet.findOne({ memberId: req.member._id });
    if (!senderWallet) {
        res.status(404);
        throw new Error('Sender Wallet Not Found');
    }

    // Check if wallet balance is sufficient for the qr payment
    logger.info(`Checking wallet balance - Sender balance : RM ${senderWallet.balance / 100}, QR payment amount : RM ${amount / 100}`);
    if (senderWallet.balance < amount) {
        res.status(402); // HTTP 402: Payment Required
        throw new Error('Insufficient funds');
    }

    logger.info('Fetching recipient wallet details');
    const recipientWallet = await Wallet.findOne({ paymentCode });
    if (!recipientWallet) {
        res.status(404);
        throw new Error('Recipient Not Found');
    } else if (paymentCode.trim() === senderWallet.paymentCode) {
        res.status(400);
        throw new Error('Could not transfer to your own account');
    }
    logger.info(`Recipient balance : RM ${recipientWallet.balance / 100}, Receiving amount : RM ${amount / 100}`);

    logger.info('Fetching recipient details');
    const recipient = await Member.findOne({ _id: recipientWallet.memberId }, { userName: 1, fullName: 1, email: 1, phone: 1 });
    if (!recipient) {
        res.status(404);
        throw new Error('Recipient Not Found');
    }

    if (!recipient.userName && !recipient.fullName) {
        logger.warn('Member has not set username or fullname');
        res.status(400);
        throw new Error('Member has not completed their profile');
    }

    const recipientDisplayName = recipient.userName || recipient.fullName;
    const senderDescription = `QR Payment to ${recipientDisplayName}`;

    const senderDisplayName = req.member.userName || req.member.fullName;
    const recipientDescription = `Received QR Payment from ${senderDisplayName}`;

    logger.info('Creating sender debit transaction');
    const senderTransaction = await Transaction.create({
        walletId: senderWallet._id,
        systemType: 'HubWallet',
        type: 'Debit',
        description: senderDescription,
        status: 'Success',
        counterpartyWalletId: recipientWallet._id,
        amount: amount
    });

    logger.info('Creating merchant credit transaction');
    const recipientTransaction = await Transaction.create({
        walletId: recipientWallet._id,
        systemType: 'HubWallet',
        type: 'Credit',
        description: recipientDescription,
        status: 'Success',
        counterpartyWalletId: senderWallet._id,
        amount: amount
    });

    if (senderTransaction && recipientTransaction) {

        logger.info('Deducting sender wallet balance');
        senderWallet.balance -= Number(amount);
        await senderWallet.save();

        logger.info('Adding recipient wallet balance');
        recipientWallet.balance += Number(amount);
        await recipientWallet.save();

        logger.info(`New Sender Balance: ${senderWallet.balance}`);
        logger.info(`New Recipient Balance: ${recipientWallet.balance}`);

        // Send FCM
        logger.info('Notifying recipient via FCM');
        const message = buildQRPaymentMessage(amount, req.member);
        sendMessage(message, recipient);

        res.status(200).json({
            balance: senderWallet.balance,
            currency: senderWallet.currency
        });
    } else {
        res.status(500);
        throw new Error('Transfer failed, please try again later');
    }
});

const updatePin = asyncHandler(async (req, res) => {
    const { oldPin, newPin, minPinPrompt } = req.body;

    logger.info('Fetching wallet details');
    const wallet = await Wallet.findOne({ memberId: req.member._id }, { spendingCode: 0 });
    if (!wallet) {
        res.status(404);
        throw new Error('Wallet not found');
    }

    logger.info('Fetching configuration');
    const configurations = await Configuration.getSingleton();
    if (!configurations) {
        res.status(500);
        throw new Error('Configuration not found');
    }

    // PIN lockout check
    if (!verifyWallet(wallet, configurations)) {
        res.status(403);
        throw new Error('PIN has been locked due to multiple failed attempts. Please contact support.');
    }

    if (!wallet.pin && minPinPrompt !== undefined) {
        res.status(400);
        throw new Error('You must setup a PIN before updating the minimum PIN prompt');
    }

    if (wallet.pin) {
        // Only validate old pin if previously set-up
        if (!oldPin || !/^\d{6}$/.test(oldPin)) {
            res.status(400);
            throw new Error('Old PIN must be 6 digit number');
        }

        const isPINValid = await verifyPIN(oldPin, wallet.pin);
        if (!isPINValid) {
            // Security violation
            res.status(403);
            return await handleIncorrectPIN({
                wallet,
                configurations,
                member: req.member
            });
        }
    }

    // Only allow update minimum PIN prompt if old PIN is valid
    if (minPinPrompt !== undefined) {
        if (!/^\d+$/.test(minPinPrompt)) {
            res.status(400);
            throw new Error('Minimum amount for PIN is not valid');
        }
        if (minPinPrompt < configurations.payments.minPinPrompt || minPinPrompt > configurations.payments.maxPinPrompt) {
            res.status(400);
            throw new Error('Minimum amount for PIN must be between RM 0 to RM 1000');
        }

        wallet.minPinPrompt = minPinPrompt;
    }

    wallet.pin = await hashPIN(newPin);
    wallet.lastPinChangedAt = new Date();
    wallet.pinTries = 0;
    await wallet.save();
    logger.info('PIN updated successfully');

    res.status(200).json({
        message: 'PIN updated successfully',
    });
});

const genQRCode = asyncHandler(async (req, res) => {
    // Find the wallet linked to the member
    logger.info('Fetching wallet details');
    const wallet = await Wallet.findOne({ memberId: req.member._id });
    if (!wallet) {
        res.status(404);
        throw new Error('Wallet Not Found');
    }

    try {
        // Generates the QR code image from text
        // const qrCodeBase64 = await qrcode.toDataURL(wallet.paymentCode);

        res.status(200).json({ qrCode: wallet.paymentCode });
    } catch (error) {
        res.status(500).json({ message: 'Error generating QR code', error: error.message });
    }
});

const sendWithdrawalNotification = async (member, transaction) => {
    let htmlContent = null;

    // Conditional replacements based on withdrawal type
    if (transaction.withdrawalDetails.type === "Bank") {
        htmlContent = fs.readFileSync(path.join(__dirname, '..', 'email', 'walletWithdrawal.html'), 'utf-8');
        htmlContent = htmlContent
            .replace('${bankName}', transaction.withdrawalDetails.bankDetails.bankName || 'N/A')
            .replace('${bankAccountName}', transaction.withdrawalDetails.bankDetails.bankAccountName || 'N/A')
            .replace('${bankAccountNumber}', transaction.withdrawalDetails.bankDetails.bankAccountNumber || 'N/A')
            ;
    }

    htmlContent = htmlContent
        .replace('${member.fullName}', member.fullName)
        .replace('${member.email}', member.email)
        .replace('${member.phone}', member.phone)
        .replace('${amount}', `RM ${(transaction.amount / 100).toFixed(2)}`);

    let mailId = 'withdrawal';
    let subject = 'Reward Hub Cash Withdrawal Request';
    await sendMail(mailId, subject, htmlContent);
};

module.exports = {
    getWallet,
    topupWallet,
    withdrawWallet,
    transferVerification,
    transferWallet,
    qrPayment,
    genQRCode,
    updatePin
};
