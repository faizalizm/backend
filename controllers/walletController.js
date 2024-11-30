const asyncHandler = require('express-async-handler');
const moment = require('moment-timezone');
const axiosInstance = require('../services/axios');
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
    console.log('ninetyDaysAgo: ' + ninetyDaysAgo);

    // Find all transactions linked to the wallet
    const transactions = await Transaction.find({
        systemType: 'HubWallet',
        walletId: wallet._id,
        createdAt: {$gte: ninetyDaysAgo}
    }).sort({createdAt: -1});

    res.json({
        balance: wallet.balance,
        currency: wallet.currency,
        transactions
    });
});

const queryBillStatus = async (memberId, walletInfo, amount, toyyibBaseUrl, toyyibSecret, billCode) => {
    const startTime = Date.now();
    const maxDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
    const interval = 20 * 1000; // 20 seconds in milliseconds

    const maxAttempts = Math.floor(maxDuration / interval); // Total number of attempts allowed
    let attemptNumber = 0; // Track the current attempt number

    const checkStatus = async () => {
        try {
            const currentTime = Date.now();
            const elapsedTime = currentTime - startTime;
            attemptNumber++;
            console.log(`Checking bill status: Attempt ${attemptNumber}/${maxAttempts}`);

            // Stop polling if max duration is exceeded
            if (elapsedTime >= maxDuration) {
                console.log('Max duration reached. Marking transaction as Expired.');

                const transaction = await Transaction.findOne({billCode});
                if (transaction && transaction.status === 'In Progress') {
                    transaction.status = 'Expired';
                    await transaction.save();
                }
                return; // Stop further polling
            }

            // Query the bill status
            const response = await axiosInstance.post(
                    `${toyyibBaseUrl}/index.php/api/getBillTransactions`,
                    new URLSearchParams({
                        userSecretKey: toyyibSecret,
                        billCode: billCode
                    }),
                    {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
            );

            const billStatus = response.data;
            console.log(`Bill Status Response:`, billStatus);

            if (billStatus[0]?.billpaymentStatus === '1') {
                console.log('Bill has been paid. Updating wallet balance and transaction.');

                const transaction = await Transaction.findOne({billCode});
                if (transaction && transaction.status !== 'Success') {
                    const wallet = await Wallet.findOne({_id: walletInfo.id, memberId}).select('-paymentCode -createdAt -updatedAt -__v');
                    if (!wallet)
                        throw new Error('Wallet Not Found');

                    wallet.balance = (Number(wallet.balance) || 0) + Number(amount);
                    console.log(`Previous Wallet Balance: ${wallet.balance - amount}, Updated Wallet Balance: ${wallet.balance}`);
                    await wallet.save();

                    transaction.status = 'Success';
                    await transaction.save();
                }

                return; // Stop further polling
            } else if (billStatus[0]?.billpaymentStatus === '3') {
                console.log('Bill status is Failed');

                const transaction = await Transaction.findOne({billCode});
                if (transaction && transaction.status === 'In Progress') {
                    transaction.status = 'Failed';
                    await transaction.save();
                }
            } else {
                console.log('Bill status is In Progress. Retrying...');
                setTimeout(checkStatus, interval); // Retry after interval
            }
        } catch (error) {
            console.error('Error while checking bill status:', error.message);
            setTimeout(checkStatus, interval); // Retry after interval
        }
    };

    checkStatus(); // Start polling immediately
};

const topupWallet = asyncHandler(async (req, res) => {
    const {TOYYIB_URL, TOYYIB_SECRET, TOYYIB_CALLBACK_URL, IP} = process.env;
    const {code, amount} = req.body;


    if (!code || !amount) {
        res.status(400);
        throw new Error('Code and amount are required');
    }

    const package = await Package.findOne({code, type: 'Topup'})
            .select('code emailContent paymentChannel packageCharge');
    if (!package) {
        res.status(404);
        throw new Error('Package Not Found');
    }

    // Find the wallet linked to the member
    const wallet = await Wallet.findOne({memberId: req.member._id}).select('-paymentCode -createdAt -updatedAt -__v');
    if (!wallet) {
        res.status(404);
        throw new Error('Wallet Not Found');
    }

    // Build the Toyyib API URL
    const toyyibGetCategoryUrl = `${TOYYIB_URL}/index.php/api/getCategoryDetails`;
    let getCategoryResponse;
    console.log(toyyibGetCategoryUrl);
    console.log(TOYYIB_SECRET);
    console.log(code);

    try {
        // Check if package category still active in ToyyibPay
        getCategoryResponse = await axiosInstance.post(
                toyyibGetCategoryUrl,
                new URLSearchParams({
                    userSecretKey: TOYYIB_SECRET,
                    categoryCode: code
                }),
                {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
        );
        console.log('hehe');

        const categoryStatus = getCategoryResponse.data.categoryStatus;

        if (!categoryStatus) {
            throw new Error();
        }

    } catch (error) {
        res.status(404);
        throw new Error('Package Not Found');
    }

    const toyyibCreateBillUrl = `${TOYYIB_URL}/index.php/api/createBill`;
    const callbackUrl = TOYYIB_CALLBACK_URL.replace('<IP>', IP);
    const billExpiryDate = moment().tz('Asia/Kuala_Lumpur').add(5, 'minutes').format('DD-MM-YYYY HH:mm:ss');
    let getCreateBillResponse;

    console.table({
        userSecretKey: TOYYIB_SECRET,
        categoryCode: package.code,
        billName: getCategoryResponse.data.CategoryName,
        billDescription: getCategoryResponse.data.categoryDescription,
        billPriceSetting: 1, // 1 = Fixed Value || 2 = Buyer Set Amount
        billPayorInfo: 1, // 0 = No Payor Info || 1 = Request Payor Info
        billAmount: amount,
        billReturnUrl: '',
        billCallbackUrl: callbackUrl,
        billTo: req.member.fullName,
        billEmail: req.member.email,
        billPhone: req.member.phone,
        billContentEmail: package.emailContent, // Max 1000 chars
        billPaymentChannel: package.paymentChannel, // 0 = FPX || 1 = CC || 2 = BOTH
        billChargeToCustomer: 0, // 0 = Charge bill to cust || Off if charge owner
        billExpiryDate: billExpiryDate, // Current Time + 5 Minute = 17-12-2020 17:00:00
        enableFPXB2B: 1, // 1 = FPX (Corporate Banking) payment channel
        chargeFPXB2B: package.packageCharge // 0 = Charge owner || 1 = Charge bill owner
    });

    try {
        // Create ToyyibPay Bill
        getCreateBillResponse = await axiosInstance.post(
                toyyibCreateBillUrl,
                new URLSearchParams({
                    userSecretKey: TOYYIB_SECRET,
                    categoryCode: package.code,
                    billName: getCategoryResponse.data.CategoryName,
                    billDescription: getCategoryResponse.data.categoryDescription,
                    billPriceSetting: 1, // 1 = Fixed Value || 2 = Buyer Set Amount
                    billPayorInfo: 0, // 0 = No Payor Info || 1 = Request Payor Info
                    billAmount: amount,
                    billReturnUrl: '',
                    billCallbackUrl: callbackUrl,
//                    billTo: req.member.fullName,
//                    billEmail: req.member.email,
//                    billPhone: req.member.phone,
                    billContentEmail: package.emailContent, // Max 1000 chars
                    billPaymentChannel: package.paymentChannel, // 0 = FPX || 1 = CC || 2 = BOTH
                    billChargeToCustomer: 0, // 0 = Charge bill to cust || Off if charge owner
                    billExpiryDate: billExpiryDate, // Current Time + 5 Minute, e.g. 17-12-2020 17:00:00
                    enableFPXB2B: 1, // 1 = FPX (Corporate Banking) payment channel
                    chargeFPXB2B: package.packageCharge // 0 = Charge owner || 1 = Charge bill owner
                }),
                {headers: {'Content-Type': 'application/x-www-form-urlencoded'}});

        // Handle the response from the Toyyib API
        const billCode = getCreateBillResponse.data[0].BillCode;
        console.log(`BillCode : ${billCode}`);

        if (!billCode) {
            throw new Error();
        }
        const paymentUrl = process.env.TOYYIB_URL + '/' + billCode;

        // Create Member
        const transaction = await Transaction.create({
            walletId: wallet._id,
            systemType: 'HubWallet',
            type: 'Credit',
            description: 'Top Up',
            status: 'In Progress',
            billCode: billCode,
            packageCode: package.code,
            amount: amount
        });

        queryBillStatus(req.member.id, wallet, amount, TOYYIB_URL, TOYYIB_SECRET, billCode);

        // Return the response to the client
        res.status(200).json({paymentUrl});

    } catch (error) {
        res.status(404);
        throw new Error('Bill Could Not Be Created');
    }
});

const withdrawWallet = asyncHandler(async (req, res) => {
    res.status(404);
    throw new Error('No Yet Ready');
});

const transferWallet = asyncHandler(async (req, res) => {
    res.status(404);
    throw new Error('No Yet Ready');
});

const spendWallet = asyncHandler(async (req, res) => {
    res.status(404);
    throw new Error('No Yet Ready');
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

module.exports = {getWallet, topupWallet, withdrawWallet, transferWallet, spendWallet, genQRCode};