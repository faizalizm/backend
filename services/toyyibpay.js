const axiosInstance = require('./axios');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');
const Member = require('../models/memberModel');
const {processVIPCommision} = require('../controllers/packageController');


const {TOYYIB_URL, TOYYIB_SECRET, TOYYIB_CALLBACK_URL, IP} = process.env;

const getCategoryToyyib = async (req, res, code) => {
    // Build the Toyyib API URL
    const toyyibGetCategoryUrl = `${TOYYIB_URL}/index.php/api/getCategoryDetails`;
    let getCategoryResponse;

    try {
        const getCategoryParams = {
            userSecretKey: TOYYIB_SECRET,
            categoryCode: code
        };

        // Check if package category still active in ToyyibPay
        getCategoryResponse = await axiosInstance.post(
                toyyibGetCategoryUrl,
                new URLSearchParams(getCategoryParams),
                {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
        );

        if (!getCategoryResponse.data.categoryStatus) {
            throw new Error();
        }
        return getCategoryResponse;

    } catch (error) {
        res.status(500);
        throw new Error('Payment Gateway Unavailable');
    }
};


const createBillToyyib = async (req, res, amount, package, getCategory, billExpiryDate) => {
    try {
        const toyyibCreateBillUrl = `${TOYYIB_URL}/index.php/api/createBill`;
        const callbackUrl = TOYYIB_CALLBACK_URL.replace('<IP>', IP);
        let createBillResponse;

        const createBillParams = {
            userSecretKey: TOYYIB_SECRET,
            categoryCode: package.categoryCode,
            billName: getCategory.data.CategoryName,
            billDescription: getCategory.data.categoryDescription,
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
        };

        console.table(createBillParams);

        // Create ToyyibPay Bill
        createBillResponse = await axiosInstance.post(
                toyyibCreateBillUrl,
                new URLSearchParams(createBillParams),
                {headers: {'Content-Type': 'application/x-www-form-urlencoded'}});

        if (!createBillResponse.data[0].BillCode) {
            throw new Error();
        }
        return createBillResponse;

    } catch (error) {
        res.status(500);
        throw new Error('Topup failed, please try again later');
    }

};

const getBillTransactionsToyyib = async (memberId, walletId, amount, billCode, type) => {
    const startTime = Date.now();
    const maxDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
    const interval = 10 * 1000; // 10 seconds in milliseconds

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
                    `${TOYYIB_URL}/index.php/api/getBillTransactions`,
                    new URLSearchParams({
                        userSecretKey: TOYYIB_SECRET,
                        billCode: billCode
                    }),
                    {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
            );

            const billStatus = response.data;
            console.log(`Bill Status Response:`, billStatus);

            if (billStatus[0]?.billpaymentStatus === '1') {
                console.log('Bill has been paid. Updating transaction.');

                const transaction = await Transaction.findOne({billCode});
                if (transaction && transaction.status !== 'Success') { // Check if transaction already updated
                    transaction.status = 'Success';
                    await transaction.save();

                    if (type === "Top Up") {
                        processTopup(memberId, walletId, amount);
                    } else if (type === "VIP Payment") {
                        processVIPPayment(memberId, amount);
                    } else {
                        console.log(`Type is not defined, success payment not processed`);
                    }
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
            console.error(error.stack);
            setTimeout(checkStatus, interval); // Retry after interval
        }
    };

    checkStatus(); // Start polling immediately
};


const processTopup = async (memberId, walletId, amount) => {
    console.log('Top Up transaction, updating wallet');

    const wallet = await Wallet.findOne({_id: walletId, memberId}).select('-paymentCode -createdAt -updatedAt -__v');
    if (!wallet)
        throw new Error('Wallet Not Found');

    wallet.balance = (Number(wallet.balance)) + Number(amount);
    await wallet.save();

    console.log(`Previous Wallet Balance: ${wallet.balance - amount}, Updated Wallet Balance: ${wallet.balance}`);
};

const processVIPPayment = async (memberId, amount) => {
    console.log('VIP Payment, updating member status');

    const member = await Member.findOne({_id: memberId}).select('-paymentCode -createdAt -updatedAt -__v');
    if (!member)
        throw new Error('Member Not Found');

    member.type = 'VIP';
    member.vipAt = new Date();
    await member.save();

    console.log(`Member ${member.fullName} upgraded to VIP`);

    // Process VIP Referral Commission
    await processVIPCommision(member, amount);
};



module.exports = {getCategoryToyyib, createBillToyyib, getBillTransactionsToyyib};