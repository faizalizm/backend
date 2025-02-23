const asyncHandler = require('express-async-handler');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');

const {logger} = require('../services/logger');
const {sendMail} = require('../services/nodemailer');
const {getCategoryToyyib, createBillToyyib, getBillTransactionsToyyib} = require('../services/toyyibpay');
const {buildTransferMessage, buildQRPaymentMessage, sendMessage} = require('../services/firebaseCloudMessage');

const Member = require('../models/memberModel');
const Wallet = require('../models/walletModel');
const Package = require('../models/packageModel');
const Transaction = require('../models/transactionModel');
const Merchant = require('../models/merchantModel');

const getWallet = asyncHandler(async (req, res) => {
    // Find the wallet linked to the member
    const wallet = await Wallet.findOne({memberId: req.member._id});
    if (!wallet) {
        res.status(404);
        throw new Error('Wallet Not Found');
    }

    // Calculate the date 90 days ago
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    logger.info('Ninety Days Ago: ' + ninetyDaysAgo);

    // Find all transactions linked to the wallet
    const transactions = await Transaction.find({
        $or: [
            // Withdrawals: Include 'Success' and 'In Progress'
            {
                $and: [
                    {description: 'Withdrawal'},
                    {
                        systemType: {$in: ['HubWallet', 'FPX']},
                        walletId: wallet._id,
                        status: {$in: ['Success', 'In Progress']},
                        createdAt: {$gte: ninetyDaysAgo}
                    }
                ]
            },
            // All other transactions: Only 'Success'
            {
                $and: [
                    {description: {$ne: 'Withdrawal'}},
                    {
                        systemType: {$in: ['HubWallet', 'FPX']},
                        walletId: wallet._id,
                        status: 'Success',
                        createdAt: {$gte: ninetyDaysAgo}
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
    }).sort({createdAt: -1});

    res.status(200).json({
        balance: wallet.balance,
        points: wallet.points,
        currency: wallet.currency,
        transactions
    });
});


const topupWallet = asyncHandler(async (req, res) => {
    const {paymentChannel, amount} = req.body;

    if (!paymentChannel || !amount) {
        res.status(400);
        throw new Error('Payment channel and amount are required');
    }

    let paymentChannelToyyib;
    if (paymentChannel === 'FPX') {
        paymentChannelToyyib = '0';
    } else {
        res.status(404);
        throw new Error('Payment channel not supported');
    }

    const vipPackage = await Package.findOne(
            {type: 'Topup'},
            {name: 1, code: 1, categoryCode: 1, packageCharge: 1, emailContent: 1}
    );
    if (!vipPackage) {
        res.status(500);
        throw new Error('Package not found');
    }

    // Find the wallet linked to the member
    const wallet = await Wallet.findOne({memberId: req.member._id});
    if (!wallet) {
        res.status(500);
        throw new Error('Wallet Not Found');
    }

    const getCategory = await getCategoryToyyib(req, res, vipPackage.categoryCode);

    try {
        const billExpiryDate = moment().tz('Asia/Kuala_Lumpur').add(5, 'minutes').format('DD-MM-YYYY HH:mm:ss');

        // Create Transaction
        const transaction = await Transaction.create({
            walletId: wallet._id,
            systemType: 'HubWallet',
            type: 'N/A',
            description: 'Top Up',
            status: 'In Progress',
            packageCode: vipPackage.code,
            amount: amount
        });

        if (!transaction) {
            res.status(500);
            throw new Error('Failed to create transaction, please try again later');
        }

        const createBill = await createBillToyyib(req, res, amount, vipPackage, getCategory, billExpiryDate);
        const billCode = createBill.data[0].BillCode;
        const paymentUrl = process.env.TOYYIB_URL + '/' + billCode;

        // Update the transaction to include the BillCode
        await Transaction.findByIdAndUpdate(transaction._id, {billCode}, {new : true});

        // Query to ToyyibPay
        getBillTransactionsToyyib(req.member._id, wallet._id, amount, billCode, "Top Up");

        // Return the response to the client
        res.status(200).json({paymentUrl, paymentExpiry: billExpiryDate});

    } catch (error) {
        res.status(500);
        throw new Error('Topup failed, please try again later');
    }
});

const withdrawWallet = asyncHandler(async (req, res) => {
    const {withdrawChannel, amount, ...otherData} = req.body;

    const minWithdrawal = 1000;

    if (!amount || !withdrawChannel) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    if (amount <= 0) {
        res.status(400);
        throw new Error('Invalid withdrawal amount');
    }

    if (amount < minWithdrawal) {
        res.status(400);
        throw new Error(`Amount must be at least ${minWithdrawal}`);
    }

    // Find the wallet linked to the member
    const wallet = await Wallet.findOne({memberId: req.member._id}, {paymentCode: 0});
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
        const {bankDetails} = req.body;
        const {bankName, bankAccountName, bankAccountNumber} = bankDetails;
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

    } else if (withdrawChannel === 'MiPay') {
        const {mipayAccountNumber} = req.body;
        if (!mipayAccountNumber) {
            return res.status(400).json({message: 'Please provide MiPay account number'});
        }

        transactionData.withdrawalDetails.mipayAccountNumber = mipayAccountNumber;
    } else {
        res.status(404);
        throw new Error('Withdraw channel not supported');
    }

    logger.info(`Wallet Balance: ${wallet.balance}, Withdrawal Amount: ${amount}`);
    // Check if wallet balance is sufficient for the withdrawal
    if (wallet.balance < amount) {
        res.status(402); // HTTP 402: Payment Required
        throw new Error('Insufficient funds');
    }

    try {
        transactionData.withdrawalDetails.type = withdrawChannel;
        const transaction = await Transaction.create(transactionData);

        if (!transaction) {
            res.status(500);
            throw new Error('Failed to create transaction');
        }

        wallet.balance -= amount;
        await wallet.save();

        // Notify Admin (Asynchronously)
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

const transferVerification = asyncHandler(async(req, res) => {
    const {paymentCode, spendingCode, email, phone} = req.body;

    let recipientWallet;
    let merchant;

    if (spendingCode) {
        if (!spendingCode.startsWith('spend://')) {
            res.status(400);
            throw new Error('QR code is not valid');
        }

        merchant = await Merchant.findOne({spendingCode}, {_id: 0, memberId: 1, name: 1, cashbackRate: 1});
        if (!merchant) {
            res.status(404);
            throw new Error('Merchant Not Found');
        }

        recipientWallet = await Wallet.findOne({memberId: merchant.memberId});

        if (!recipientWallet) {
            res.status(404);
            throw new Error('Recipient Not Found');
        } else if (recipientWallet.memberId === req.member._id) {
            res.status(400);
            throw new Error('Could not transfer to your own account');
        }
    } else if (paymentCode) {
        if (!paymentCode.startsWith('payment://')) {
            res.status(400);
            throw new Error('QR code is not valid');
        }

        recipientWallet = await Wallet.findOne({paymentCode});

        if (!recipientWallet) {
            res.status(404);
            throw new Error('Recipient Not Found');
        } else if (recipientWallet.memberId === req.member._id) {
            res.status(400);
            throw new Error('Could not transfer to your own account');
        }
    } else {
        // Case 2: Sending via entered value (email or phone)
        if (!email && !phone) {
            res.status(400).json({error: 'Email or phone is required for transfer'});
            return;
        }

        if ((email && email.trim() === req.member.email)
                || phone && phone.trim() === req.member.phone) {
            res.status(400);
            throw new Error('Could not transfer to your own account');
        }
    }

    let recipient;
    if (paymentCode || spendingCode) {
        recipient = await Member.findOne({_id: recipientWallet.memberId}, {fullName: 1, email: 1, phone: 1});
    } else if (email) {
        recipient = await Member.findOne({email}, {fullName: 1, email: 1, phone: 1});
    } else if (phone) {
        recipient = await Member.findOne({phone}, {fullName: 1, email: 1, phone: 1});
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
    const {email, phone, amount} = req.body;

    if (!email && !phone) {
        res.status(400);
        throw new Error('Email or phone is required for transfer');
    }

    if (!amount) {
        res.status(400);
        throw new Error('Amount is required');
    }

    if (email && email.trim() === req.member.email) {
        res.status(400);
        throw new Error('Could not transfer to your own account');
    }

    let description;
    let recipient;
    if (phone) {
        description = 'Transfer via Phone';
        recipient = await Member.findOne({phone}, {fullName: 1, email: 1, phone: 1});
    } else if (email) {
        description = 'Transfer via Email';
        recipient = await Member.findOne({email}, {fullName: 1, email: 1, phone: 1});
    }

    if (!recipient) {
        res.status(404);
        throw new Error('Recipient Not Found');
    }

    const senderWallet = await Wallet.findOne({memberId: req.member._id});
    if (!senderWallet) {
        res.status(404);
        throw new Error('Sender Wallet Not Found');
    }

    const recipientWallet = await Wallet.findOne({memberId: recipient._id});
    if (!recipientWallet) {
        res.status(404);
        throw new Error('Recipient Wallet Not Found');
    }

    // Check if wallet balance is sufficient for the withdrawal
    if (senderWallet.balance < amount) {
        res.status(402); // HTTP 402: Payment Required
        throw new Error('Insufficient funds');
    }

    const senderTransaction = await Transaction.create({
        walletId: senderWallet._id,
        systemType: 'HubWallet',
        type: 'Debit',
        description,
        status: 'Success',
        counterpartyWalletId: recipientWallet._id,
        amount: amount
    });

    const recipientTransaction = await Transaction.create({
        walletId: recipientWallet._id,
        systemType: 'HubWallet',
        type: 'Credit',
        description,
        status: 'Success',
        counterpartyWalletId: senderWallet._id,
        amount: amount
    });

    if (senderTransaction && recipientTransaction) {

        logger.info(`Sender Balance: ${senderWallet.balance}, Transfer Amount: ${amount}`);
        logger.info(`Recipient Balance: ${recipientWallet.balance}, Transer Amount: ${amount}`);

        senderWallet.balance -= Number(amount);
        await senderWallet.save();

        recipientWallet.balance += Number(amount);
        await recipientWallet.save();

        logger.info(`New Sender Balance: ${senderWallet.balance}`);
        logger.info(`New Recipient Balance: ${recipientWallet.balance}`);

        // Send FCM
        const message = buildTransferMessage(amount);
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
    const {paymentCode, amount} = req.body;

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

    const senderWallet = await Wallet.findOne({memberId: req.member._id});
    if (!senderWallet) {
        res.status(404);
        throw new Error('Sender Wallet Not Found');
    }

    // Check if wallet balance is sufficient for the qr payment
    logger.info(`Sender wallet balance : ${senderWallet.balance}`);
    if (senderWallet.balance < amount) {
        res.status(402); // HTTP 402: Payment Required
        throw new Error('Insufficient funds');
    }

    const recipientWallet = await Wallet.findOne({paymentCode});
    if (!recipientWallet) {
        res.status(404);
        throw new Error('Recipient Not Found');
    } else if (paymentCode.trim() === senderWallet.paymentCode) {
        res.status(400);
        throw new Error('Could not transfer to your own account');
    }
    logger.info(`Recipient wallet balance : ${recipientWallet.balance}`);

    const recipient = await Member.findOne({_id: recipientWallet.memberId}, {fullName: 1, email: 1, phone: 1});
    if (!recipient) {
        res.status(404);
        throw new Error('Recipient Not Found');
    }

    const description = 'QR Payment';

    const senderTransaction = await Transaction.create({
        walletId: senderWallet._id,
        systemType: 'HubWallet',
        type: 'Debit',
        description,
        status: 'Success',
        counterpartyWalletId: recipientWallet._id,
        amount: amount
    });

    const recipientTransaction = await Transaction.create({
        walletId: recipientWallet._id,
        systemType: 'HubWallet',
        type: 'Credit',
        description,
        status: 'Success',
        counterpartyWalletId: senderWallet._id,
        amount: amount
    });

    if (senderTransaction && recipientTransaction) {

        logger.info(`Sender Balance: ${senderWallet.balance}, Transfer Amount: ${amount}`);
        logger.info(`Recipient Balance: ${recipientWallet.balance}, Transfer Amount: ${amount}`);

        senderWallet.balance -= Number(amount);
        await senderWallet.save();

        recipientWallet.balance += Number(amount);
        await recipientWallet.save();

        logger.info(`New Sender Balance: ${senderWallet.balance}`);
        logger.info(`New Recipient Balance: ${recipientWallet.balance}`);

        // Send FCM
        const message = buildQRPaymentMessage(amount);
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

const genQRCode = asyncHandler(async (req, res) => {
    // Find the wallet linked to the member
    const wallet = await Wallet.findOne({memberId: req.member._id});
    if (!wallet) {
        res.status(404);
        throw new Error('Wallet Not Found');
    }

    try {
        // Generates the QR code image from text
        // const qrCodeBase64 = await qrcode.toDataURL(wallet.paymentCode);

        res.status(200).json({qrCode: wallet.paymentCode});
    } catch (error) {
        res.status(500).json({message: 'Error generating QR code', error: error.message});
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
                .replace('${mipayAccountNumber}', '');
    } else if (transaction.withdrawalDetails.type === "MiPay") {
        htmlContent = fs.readFileSync(path.join(__dirname, '..', 'email', 'walletWithdrawalCard.html'), 'utf-8');
        htmlContent = htmlContent
                .replace('${mipayAccountNumber}', transaction.withdrawalDetails.mipayAccountNumber || 'N/A')
                .replace('${bankName}', '')
                .replace('${bankAccountName}', '')
                .replace('${bankAccountNumber}', '');
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

module.exports = {getWallet, topupWallet, withdrawWallet, transferVerification, transferWallet, qrPayment, genQRCode};
