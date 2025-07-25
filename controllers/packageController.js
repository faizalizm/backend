const asyncHandler = require('express-async-handler');
const moment = require('moment-timezone');

const { generateUniqueId } = require('../services/mongodb');
const { logger } = require('../services/logger');
const { getCategoryToyyib, createBillToyyib, getBillTransactionsToyyib } = require('../services/toyyibpay');
const { resizeImage } = require('../services/sharp');

const Package = require('../models/packageModel');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');
const Logistic = require('../models/logisticModel');

const { processVIPCommision } = require('../controllers/commisionController');

const { sendShipmentNotification } = require('../utility/mailBuilder.js');
const { formatAmount } = require('../utility/formatter');

const getPackage = asyncHandler(async (req, res) => {
    logger.info('Checking member user type');
    if (req.member.type === "VIP") {
        res.status(400);
        throw new Error('Member is already a VIP');
    }

    logger.info('Fetching packages - Status : Not inactive');
    const vipPackage = await Package.find(
        {
            type: 'VIP',
            status: { $ne: 'Inactive' }
        },
        { _id: 0, picture: 1, type: 1, name: 1, description: 1, price: 1, code: 1 }
    );

    logger.info('Resizing packages picture');
    for (const package of vipPackage) {
        if (package.picture) {
            package.picture = await resizeImage(package.picture, process.env.IMAGE_WIDTH_PACKAGE_LIST, process.env.IMAGE_QUALITY_PACKAGE_LIST);
        }
    }

    if (vipPackage.length > 0) {
        res.status(200).json(vipPackage);
    } else {
        res.status(404);
        throw new Error('No Package Available');
    }
});

const purchasePackage = asyncHandler(async (req, res) => {
    const { code, paymentChannel } = req.body;

    if (!paymentChannel) { // To determine payment method
        res.status(400);
        throw new Error('Package Channel is required');
    } else if (!code) { // To determine which VIP package
        res.status(400);
        throw new Error('Package code is required');
    }

    logger.info('Checking member user type');
    if (req.member.type === "VIP") {
        res.status(400);
        throw new Error('Member is already a VIP');
    }

    logger.info('Checking member shipping details');
    if (!req.member.shippingDetails) {
        res.status(400);
        throw new Error('Please fill up shipping details');
    }

    logger.info('Fetching VIP packages');
    const vipPackage = await Package.findOne(
        { code, type: 'VIP' },
        { name: 1, price: 1, categoryCode: 1, packageCharge: 1, emailContent: 1 }
    );

    if (!vipPackage) {
        res.status(404);
        throw new Error('Package Not Found');
    }

    logger.info('Overriding package price to RM 250');
    // Temporarily override package price
    vipPackage.price = 30000;

    // Find the wallet linked to the member
    logger.info('Fetching wallet details');
    const wallet = await Wallet.findOne(
        { memberId: req.member._id },
        { paymentCode: 0 }
    );

    if (!wallet) {
        res.status(404);
        throw new Error('Wallet Not Found');
    }

    if (paymentChannel === 'HubWallet') {

        logger.info(`Wallet Balance: ${wallet.balance}, Package Price: ${vipPackage.price}`);

        // Check if wallet balance is sufficient for the package
        logger.info('Checking wallet balance');
        if (wallet.balance < vipPackage.price) {
            res.status(402); // HTTP 402: Payment Required
            throw new Error('Insufficient funds. Please top up your account.');
        }

        logger.info('Deducting wallet balance');
        wallet.balance -= vipPackage.price;
        await wallet.save();

        logger.info('Upgrading user type');
        req.member.type = 'VIP';
        req.member.vipAt = new Date();
        await req.member.save();

        // Create Transaction
        logger.info('Creating debit transaction');
        const transaction = await Transaction.create({
            referenceNumber: generateUniqueId('RH-PKG'),
            walletId: wallet._id,
            systemType: 'HubWallet',
            type: 'Debit',
            description: 'VIP Payment',
            status: 'Success',
            packageCode: code,
            amount: vipPackage.price,
            ...(req.member.shippingDetails && { shippingStatus: 'Preparing' }),
            ...(req.member.shippingDetails && { shippingDetails: req.member.shippingDetails })
        });

        // Process VIP Referral Commission
        processVIPCommision(req.member, vipPackage.price);

        logger.info('Creating logistic tracking');
        const [logisticTracking] = await Logistic.create([{
            referenceNumber: generateUniqueId('RH-PKG'),
            memberId: req.member._id,
            transactionId: transaction._id,
            systemType: 'Package',
            description: `1x ${vipPackage.name}`,
            packageId: vipPackage._id,
            shippingDetails: req.member.shippingDetails,
            status: 'Preparing',
            statusHistory: [{
                status: 'Preparing',
                updatedAt: new Date(),
                updatedBy: req.member._id
            }]
        }]);
        logger.info(`Logistic tracking created: ${logisticTracking._id}`);

        if (req.member.shippingDetails) {
            logger.info('Sending shipping notification via email');
            sendShipmentNotification(req.member, logisticTracking.toJSON(), formatAmount(transaction.amount));
        }

        res.status(200).json({
            message: 'Package purchased successfully. You have upgraded to VIP!',
            remainingBalance: wallet.balance,
            memberType: req.member.type
        });

    } else if (paymentChannel === 'FPX') {

        // FPX STOP
        res.status(404);
        throw new Error('Payment channel not available');
        // FPX STOP

        logger.info('Fetching ToyyibPay category');
        const getCategory = await getCategoryToyyib(req, res, vipPackage.categoryCode);

        try {
            const billExpiryDate = moment().tz('Asia/Kuala_Lumpur').add(5, 'minutes').format('DD-MM-YYYY HH:mm:ss');

            // Create Transaction
            logger.info('Creating in progress transaction');
            const transaction = await Transaction.create({
                referenceNumber: generateUniqueId('RH-PKG'),
                walletId: wallet._id,
                systemType: 'HubWallet',
                type: 'Credit',
                description: 'VIP Payment',
                status: 'In Progress',
                packageCode: code,
                amount: vipPackage.price,
                ...(req.member.shippingDetails && { shippingStatus: 'Preparing' }),
                ...(req.member.shippingDetails && { shippingDetails: req.member.shippingDetails })
            });

            if (!transaction) {
                res.status(500);
                throw new Error('Failed to create transaction, please try again later');
            }

            const createBill = await createBillToyyib(req, res, vipPackage.price, vipPackage, getCategory, billExpiryDate);
            const billCode = createBill.data[0].BillCode;
            const paymentUrl = process.env.TOYYIB_URL + '/' + billCode;

            // Update the transaction to include the BillCode
            await Transaction.findByIdAndUpdate(transaction._id, { billCode }, { new: true });

            // Query to ToyyibPay
            logger.info('Fetching ToyyibPay transaction status');
            getBillTransactionsToyyib(req.member._id, wallet._id, vipPackage.price, billCode, "VIP Payment");

            // Return the response to the client
            res.status(200).json({ paymentUrl, paymentExpiry: billExpiryDate });

        } catch (error) {
            res.status(500);
            logger.error(`Error processing VIP Payment : ${error.message}`);
            throw new Error('VIP payment failed, please try again later');
        }


    } else {
        res.status(404);
        throw new Error('Payment channel not available');
    }

});

const purchaseCallbackPackage = asyncHandler(async (req, res) => {
    logger.info('Receiving ToyyibPay callback');
    res.status(200).json({ message: 'OK' });
});

module.exports = { getPackage, purchasePackage, purchaseCallbackPackage };