const asyncHandler = require('express-async-handler');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');

const axiosInstance = require('../services/axios');
const {logger} = require('../services/logger');
const {sendMail} = require('../services/nodemailer');
const {getCategoryToyyib, createBillToyyib, getBillTransactionsToyyib} = require('../services/toyyibpay');

const Package = require('../models/packageModel');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');

const {processVIPCommision} = require('../controllers/commisionController');

const getPackage = asyncHandler(async (req, res) => {
    if (req.member.type === "VIP") {
        res.status(400);
        throw new Error('Member is already a VIP');
    }

    const package = await Package.find(
            {type: 'VIP'},
            {_id: 0, picture: 1, type: 1, name: 1, description: 1, price: 1, code: 1}
    );

    if (package.length > 0) {
        res.json(package);
    } else {
        res.status(404);
        throw new Error('No Package Available');
    }
});

const purchasePackage = asyncHandler(async (req, res) => {
    const {code, paymentChannel, shippingDetails} = req.body;

    if (!paymentChannel) { // To determine payment method
        res.status(400);
        throw new Error('Package Channel is required');
    } else if (!code) { // To determine which VIP package
        res.status(400);
        throw new Error('Package code is required');
    }

    if (req.member.type === "VIP") {
        res.status(400);
        throw new Error('Member is already a VIP');
    }

    const package = await Package.findOne(
            {code, type: 'VIP'},
            {name: 1, price: 1, categoryCode: 1, packageCharge: 1, emailContent: 1}
    );
    if (!package) {
        res.status(404);
        throw new Error('Package Not Found');
    }

    // Find the wallet linked to the member
    const wallet = await Wallet.findOne(
            {memberId: req.member._id},
            {paymentCode: 0}
    );
    if (!wallet) {
        res.status(404);
        throw new Error('Wallet Not Found');
    }


    if (paymentChannel === 'HubWallet') {

        logger.info(`Wallet Balance: ${wallet.balance}, Package Price: ${package.price}`);

        // Check if wallet balance is sufficient for the package
        if (wallet.balance < package.price) {
            res.status(402); // HTTP 402: Payment Required
            throw new Error('Insufficient funds. Please top up your account.');
        }

        wallet.balance -= package.price;
        await wallet.save();

        req.member.type = 'VIP';
        req.member.vipAt = new Date();
        await req.member.save();

        // Create Transaction
        const transaction = await Transaction.create({
            walletId: wallet._id,
            systemType: 'HubWallet',
            type: 'Debit',
            description: 'VIP Payment',
            status: 'Success',
            packageCode: code,
            amount: package.price,
            ...(shippingDetails && {shippingStatus: 'Preparing'}),
            ...(shippingDetails && {shippingDetails})
        });

        // Process VIP Referral Commission
        processVIPCommision(req.member, package.price);

        if (shippingDetails) {
            setImmediate(() => sendShippingNotification(transaction));
        }
        res.status(200).json({
            message: 'Package purchased successfully. You have upgraded to VIP!',
            remainingBalance: wallet.balance,
            memberType: req.member.type
        });

    } else if (paymentChannel === 'FPX') {

        const getCategory = await getCategoryToyyib(req, res, package.categoryCode);

        try {
            const billExpiryDate = moment().tz('Asia/Kuala_Lumpur').add(5, 'minutes').format('DD-MM-YYYY HH:mm:ss');

            // Create Transaction
            const transaction = await Transaction.create({
                walletId: wallet._id,
                systemType: 'FPX',
                type: 'N/A',
                description: 'VIP Payment',
                status: 'In Progress',
                packageCode: code,
                amount: package.price,
                ...(shippingDetails && {shippingStatus: 'Preparing'}),
                ...(shippingDetails && {shippingDetails})
            });

            if (!transaction) {
                res.status(500);
                throw new Error('Failed to create transaction, please try again later');
            }

            const createBill = await createBillToyyib(req, res, package.price, package, getCategory, billExpiryDate);
            const billCode = createBill.data[0].BillCode;
            const paymentUrl = process.env.TOYYIB_URL + '/' + billCode;

            // Update the transaction to include the BillCode
            await Transaction.findByIdAndUpdate(transaction._id, {billCode}, {new : true});

            // Query to ToyyibPay
            getBillTransactionsToyyib(req.member._id, wallet._id, package.price, billCode, "VIP Payment");

            // Return the response to the client
            res.status(200).json({paymentUrl, paymentExpiry: billExpiryDate});

        } catch (error) {
            res.status(500);
            logger.info(error.stack);
            throw new Error('VIP payment failed, please try again later');
        }


    } else {
        res.status(404);
        throw new Error('Payment channel not available');
    }

});

const purchaseCallbackPackage = asyncHandler(async (req, res) => {
    res.status(200).json({message: 'OK'});
});

const sendShippingNotification = async (transaction) => {
    // Fetch and modify HTML template
    const htmlTemplatePath = path.join(__dirname, '..', 'email', 'packageShipping.html');
    let htmlContent = fs.readFileSync(htmlTemplatePath, 'utf-8');

    htmlContent = htmlContent.replace('${packageCode}', `${transaction.packageCode}`);
    htmlContent = htmlContent.replace('${phone}', `${transaction.shippingDetails.phone}`);
    htmlContent = htmlContent.replace('${addressLine1}', `${transaction.shippingDetails.addressLine1}`);
    htmlContent = htmlContent.replace('${addressLine2}', `${transaction.shippingDetails.addressLine2 || ''}`);
    htmlContent = htmlContent.replace('${addressLine3}', `${transaction.shippingDetails.addressLine3 || ''}`);
    htmlContent = htmlContent.replace('${city}', `${transaction.shippingDetails.city}`);
    htmlContent = htmlContent.replace('${state}', `${transaction.shippingDetails.state || ''}`);
    htmlContent = htmlContent.replace('${postCode}', `${transaction.shippingDetails.postCode}`);
    htmlContent = htmlContent.replace('${country}', `${transaction.shippingDetails.country}`);


    let mailId = 'shipping';
    let subject = 'Reward Hub Shipping Notification';
    await sendMail(mailId, subject, htmlContent);
};

module.exports = {getPackage, purchasePackage, purchaseCallbackPackage};