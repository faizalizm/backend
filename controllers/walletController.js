const asyncHandler = require('express-async-handler');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const {getCategoryToyyib, createBillToyyib, getBillTransactionsToyyib} = require('../services/toyyibpay');
const Member = require('../models/memberModel');
const Wallet = require('../models/walletModel');
const Package = require('../models/packageModel');
const Transaction = require('../models/transactionModel');

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
    console.log('Ninety Days Ago: ' + ninetyDaysAgo);

    // Find all transactions linked to the wallet
    const transactions = await Transaction.find({
        $or: [
            {systemType: 'HubWallet'},
            {systemType: 'FPX'}
        ],
        walletId: wallet._id,
        createdAt: {$gte: ninetyDaysAgo}
    }).select('-_id -walletId -__v').sort({createdAt: -1});

    res.json({
        balance: wallet.balance,
        currency: wallet.currency,
        transactions
    });
});


const topupWallet = asyncHandler(async (req, res) => {
    const {paymentChannel, amount} = req.body;

    if (!paymentChannel || !amount) {
        res.status(400);
        throw new Error('Payment Channel and amount are required');
    }

    let paymentChannelToyyib;
    if (paymentChannel === 'FPX') {
        paymentChannelToyyib = '0';
    }

    const package = await Package.findOne({type: 'Topup'}).select('categoryCode emailContent packageCharge -_id');
    if (!package) {
        res.status(404);
        throw new Error('Package Not Found');
    }

    // Find the wallet linked to the member
    const wallet = await Wallet.findOne({memberId: req.member._id}).select('-paymentCode -createdAt -updatedAt -__v');
    if (!wallet) {
        res.status(500);
        throw new Error('Wallet Not Found');
    }

    const getCategory = await getCategoryToyyib(req, res, package.categoryCode);

    try {
        const billExpiryDate = moment().tz('Asia/Kuala_Lumpur').add(5, 'minutes').format('DD-MM-YYYY HH:mm:ss');

        // Create Transaction
        const transaction = await Transaction.create({
            walletId: wallet._id,
            systemType: 'HubWallet',
            type: 'N/A',
            description: 'Top Up',
            status: 'In Progress',
            packageCode: package.code,
            amount: amount
        });

        if (!transaction) {
            res.status(500);
            throw new Error('Failed to create transaction, please try again later');
        }

        const createBill = await createBillToyyib(req, res, amount, package, getCategory, billExpiryDate);
        const billCode = createBill.data[0].BillCode;
        const paymentUrl = process.env.TOYYIB_URL + '/' + billCode;

        // Update the transaction to include the BillCode
        await Transaction.findByIdAndUpdate(transaction._id, {billCode}, {new : true});

        // Query to ToyyibPay
        getBillTransactionsToyyib(req.member._id, wallet, amount, billCode, "Top Up");

        // Return the response to the client
        res.status(200).json({paymentUrl, paymentExpiry: billExpiryDate});

    } catch (error) {
        res.status(500);
        throw new Error('Topup failed, please try again later');
    }
});

const withdrawWallet = asyncHandler(async (req, res) => {
    const {amount, bankName, bankAccountName, bankAccountNumber} = req.body;
    const minWithdrawal = 1000;

    if (!amount || !bankName || !bankAccountName || !bankAccountNumber) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    if (amount <= 0) {
        res.status(400);
        throw new Error('Invalid withdrawal amount');
    }

    if (!/^\d+$/.test(bankAccountNumber)) {
        res.status(400);
        throw new Error('Invalid bank account number format');
    }

    if (amount < minWithdrawal) {
        res.status(400);
        throw new Error(`Amount must be at least ${minWithdrawal}`);
    }

    // Find the wallet linked to the member
    const wallet = await Wallet.findOne({memberId: req.member._id});
    if (!wallet) {
        res.status(404);
        throw new Error('Wallet Not Found');
    }

    console.log(`Wallet Balance: ${wallet.balance}, Withdrawal Amount: ${amount}`);
    // Check if wallet balance is sufficient for the withdrawal
    if (wallet.balance < amount) {
        res.status(402); // HTTP 402: Payment Required
        throw new Error('Insufficient funds');
    }

    try {
        // Create Transaction
        const transaction = await Transaction.create({
            walletId: wallet._id,
            systemType: 'HubWallet',
            type: 'Debit',
            description: 'Withdrawal',
            status: 'In Progress',
            amount: amount,
            bankName, bankAccountName, bankAccountNumber
        });

        if (!transaction) {
            res.status(500);
            throw new Error('Failed to create transaction');
        }

        wallet.balance -= amount;
        await wallet.save();

        // Notify Admin (Asynchronously)
        setImmediate(() => sendWithdrawalNotification(req.member, transaction));

        res.status(200).json({
            balance: wallet.balance,
            currency: wallet.currency
        });
    } catch (error) {
        console.error('Error processing withdrawal:', error);

        res.status(500);
        throw new Error('Withdrawal failed, please try again later');
    }
});

const transferVerification = asyncHandler(async(req, res) => {
    const {email, phone} = req.body;

    if (!email && !phone) {
        res.status(400);
        throw new Error('Email or phone is required for transfer');
    }

    if (email && email.trim() === req.member.email) {
        res.status(400);
        throw new Error('Could not transfer to your own account');
    }

    let recipient;
    if (phone) {
        recipient = await Member.findOne({phone});
    } else if (email) {
        recipient = await Member.findOne({email});
    }

    if (!recipient) {
        res.status(404);
        throw new Error('Recipient Not Found');
    } else {
        res.status(200).json({
            memberFullName: recipient.fullName,
        });
    }
});

const transferWallet = asyncHandler(async (req, res) => {
    const {email, phone, amount} = req.body;

    if (!email || !phone) {
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
        recipient = await Member.findOne({phone});
    } else if (email) {
        description = 'Transfer via Email';
        recipient = await Member.findOne({email});
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

        console.log(`Sender Balance: ${senderWallet.balance}, Transfer Amount: ${amount}`);
        console.log(`Recipient Balance: ${recipientWallet.balance}, Transer Amount: ${amount}`);

        senderWallet.balance -= Number(amount);
        await senderWallet.save();

        recipientWallet.balance += Number(amount);
        await recipientWallet.save();

        console.log(`New Sender Balance: ${senderWallet.balance}`);
        console.log(`New Recipient Balance: ${recipientWallet.balance}`);

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

    const recipientWallet = await Wallet.findOne({paymentCode});
    if (!recipientWallet) {
        res.status(404);
        throw new Error('Recipient Not Found');
    } else if (paymentCode.trim() === req.member.paymentCode) {
        res.status(400);
        throw new Error('Could not transfer to your own account');
    }

    const senderWallet = await Wallet.findOne({memberId: req.member._id});
    if (!senderWallet) {
        res.status(404);
        throw new Error('Sender Wallet Not Found');
    }

    // Check if wallet balance is sufficient for the qr payment
    if (senderWallet.balance < amount) {
        res.status(402); // HTTP 402: Payment Required
        throw new Error('Insufficient funds');
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

        console.log(`Sender Balance: ${senderWallet.balance}, Transfer Amount: ${amount}`);
        console.log(`Recipient Balance: ${recipientWallet.balance}, Transer Amount: ${amount}`);

        senderWallet.balance -= Number(amount);
        await senderWallet.save();

        recipientWallet.balance += Number(amount);
        await recipientWallet.save();

        console.log(`New Sender Balance: ${senderWallet.balance}`);
        console.log(`New Recipient Balance: ${recipientWallet.balance}`);

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
    const htmlTemplatePath = path.join(__dirname, '..', 'email', 'walletWithdrawal.html');
    let htmlContent = fs.readFileSync(htmlTemplatePath, 'utf-8');

    // Replace placeholders with actual data
    htmlContent = htmlContent.replace('${member.fullName}', member.fullName);
    htmlContent = htmlContent.replace('${member.email}', member.email);
    htmlContent = htmlContent.replace('${member.phone}', member.phone);

    htmlContent = htmlContent.replace('${bankName}', transaction.bankName);
    htmlContent = htmlContent.replace('${bankAccountName}', transaction.bankAccountName);
    htmlContent = htmlContent.replace('${bankAccountNumber}', transaction.bankAccountNumber);

    htmlContent = htmlContent.replace('${amount}', "RM " + (transaction.amount / 100).toFixed(2));

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_NOREPLY,
                pass: process.env.EMAIL_PWD
            }
        });

        await transporter.sendMail({
            from: process.env.EMAIL_NOREPLY,
            to: process.env.EMAIL_ADMIN,
            subject: 'RewardsHub Cash Withdrawal Request',
            html: htmlContent,
            messageId: `invite-${Date.now()}@gmail.com`,
            headers: {
                'X-Priority': '1',
                'X-Mailer': 'Nodemailer'
            }
        });

        console.log('Admin notification sent successfully');
    } catch (error) {
        console.error('Failed to send admin notification:', error);
    }
};


//const processSpendingReward = async (spenderWallet, member, amount) => {
//    console.log(`Processing Spending Rewards`);
//    
//    const spenderPercentages = 10;
//    const spenderReward = (amount * percentage) / 100;
//
//    spenderWallet.balance = Number(spenderWallet.balance) + spenderReward;
//    await spenderWallet.save();
//
//    await Transaction.create({
//        walletId: spenderWallet._id,
//        systemType: 'HubPoints',
//        type: 'Credit',
//        description: 'Spending Rewards',
//        status: 'Success',
//        memberId: member._id,
//        amount: 
//    });
//
//
//    // Percentages for each level
//    const percentages = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
//    console.log(percentages.length);
//
//    let currentMember = member.referredBy;
//    let level = 0;
//
//    const visited = new Set();
//
//    try {
//        while (currentMember && level < 20) {
//            if (visited.has(currentMember)) {
//                console.log('Cycle detected in referral chain. Breaking loop.');
//                break;
//            }
//            visited.add(currentMember);
//
//            // Find the upline member
//            const uplineMember = await Member.findOne({referralCode: currentMember}).select('_id fullName referralCode referredBy type');
//            if (!uplineMember)
//                break;
//
//            // Calculate the commission for this level
//            const percentage = percentages[level] ?? 0; // If percentage not specied, then 0 commission
//            const commission = (amount * percentage) / 100;
//
//
//            if (uplineMember.type !== 'VIP' && level < 3) {
//                console.log(`Upline Member ${uplineMember.fullName} (Level ${level + 1}) missed on receiving ${percentage}% (RM ${(commission / 100).toFixed(2)})`);
//            } else {
//                const uplineWallet = await Wallet.findOne({memberId: uplineMember._id}).select('balance');
//                if (!uplineWallet) {
//                    console.log(`Wallet not found for upline member ${uplineMember.fullName}`);
//                } else {
//                    uplineWallet.balance = Number(uplineWallet.balance) + commission;
//                    await uplineWallet.save();
//
//                    await Transaction.create({
//                        walletId: uplineWallet._id,
//                        systemType: 'HubWallet',
//                        type: 'Credit',
//                        description: 'VIP Registration Commission',
//                        status: 'Success',
//                        memberId: member._id,
//                        amount: amount
//                    });
//
//                    console.log(`Upline Member ${uplineMember.fullName} (Level ${level + 1}) received ${percentage}% (RM ${(commission / 100).toFixed(2)})`);
//                }
//            }
//
//            // Move to the next upline
//            currentMember = uplineMember.referredBy;
//            level++;
//        }
//    } catch (error) {
//        console.error(`Error processing VIP commission at Level ${level + 1}: ${error.message}`);
//        console.error(error.stack);
//    }
//};

module.exports = {getWallet, topupWallet, withdrawWallet, transferVerification, transferWallet, qrPayment, genQRCode};