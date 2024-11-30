
const axiosInstance = require('../services/axios');
const asyncHandler = require('express-async-handler');
const Package = require('../models/packageModel');

const getPackage = asyncHandler(async (req, res) => {
    if (req.member.type === "VIP") {
        res.status(400);
        throw new Error('Member is already a VIP');
    }

    const package = await Package.find().select('-_id -createdAt -updatedAt -__v');

    if (package.length > 0) {
        res.json(package);
    } else {
        res.status(404);
        throw new Error('No Package Available');
    }
});

const purchasePackage = asyncHandler(async (req, res) => {
    const {code} = req.body;

    // Validate request body
    if (!code) {
        res.status(400);
        throw new Error('Package code is required');
    }

    const package = await Package.findOne({code});
    if (!package) {
        res.status(404);
        throw new Error('Package Not Found');
    }

    const toyyibBaseUrl = process.env.TOYYIB_URL;
    const toyyibSecret = process.env.TOYYIB_SECRET;

    // Build the Toyyib API URL
    const toyyibGetCategoryUrl = `${toyyibBaseUrl}/index.php/api/getCategoryDetails`;
    let categoryData;

    try {
        // Check if package category still active in ToyyibPay
        getCategoryResponse = await axiosInstance.post(
                toyyibGetCategoryUrl,
                new URLSearchParams({
                    userSecretKey: toyyibSecret,
                    categoryCode: code
                }),
                {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
        );


        const categoryStatus = getCategoryResponse.data.categoryStatus;

        if (!categoryStatus) {
            throw new Error();
        }

    } catch (error) {
        res.status(404);
        throw new Error('Package Not Found');
    }

    const toyyibCreateBillUrl = `${toyyibBaseUrl}/index.php/api/createBill`;
    const callbackUrl = process.env.TOYYIB_CALLBACK_URL.replace('<IP>', process.env.IP);
    let getCreateBillResponse;
    console.table({
        userSecretKey: toyyibSecret,
        categoryCode: package.code,
        billName: getCategoryResponse.data.CategoryName,
        billDescription: getCategoryResponse.data.categoryDescription,
        billPriceSetting: 1, // 1 = Fixed Value || 2 = Buyer Set Amount
        billPayorInfo: 1, // 0 = No Payor Info || 1 = Request Payor Info
        billAmount: package.price,
        billReturnUrl: '',
        billCallbackUrl: callbackUrl,
        billTo: req.member.fullName,
        billEmail: req.member.email,
        billPhone: req.member.phone,
        billContentEmail: package.emailContent, // Max 1000 chars
        billPaymentChannel: package.paymentChannel, // 0 = FPX || 1 = CC || 2 = BOTH
        billChargeToCustomer: 0, // 0 = Charge bill to cust || Off if charge owner
        billExpiryDate: '', // Current Time + 5 Minute = 17-12-2020 17:00:00
        enableFPXB2B: 1, // 1 = FPX (Corporate Banking) payment channel
        chargeFPXB2B: package.packageCharge // 0 = Charge owner || 1 = Charge bill owner
    });

    try {
        // Create ToyyibPay Bill
        getCreateBillResponse = await axiosInstance.post(
                toyyibCreateBillUrl,
                new URLSearchParams({
                    userSecretKey: toyyibSecret,
                    categoryCode: package.code,
                    billName: getCategoryResponse.data.CategoryName,
                    billDescription: getCategoryResponse.data.categoryDescription,
                    billPriceSetting: 1, // 1 = Fixed Value || 2 = Buyer Set Amount
                    billPayorInfo: 0, // 0 = No Payor Info || 1 = Request Payor Info
                    billAmount: package.price,
                    billReturnUrl: '',
                    billCallbackUrl: callbackUrl,
//                    billTo: req.member.fullName,
//                    billEmail: req.member.email,
//                    billPhone: req.member.phone,
                    billContentEmail: package.emailContent, // Max 1000 chars
                    billPaymentChannel: package.paymentChannel, // 0 = FPX || 1 = CC || 2 = BOTH
                    billChargeToCustomer: 0, // 0 = Charge bill to cust || Off if charge owner
                    billExpiryDate: '', // Current Time + 5 Minute = 17-12-2020 17:00:00
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

        // Return the response to the client
        res.status(200).json({paymentUrl});

    } catch (error) {
        res.status(404);
        throw new Error('Bill Could Not Be Created');
    }


});

const handlePaymentCallback = asyncHandler(async (req, res) => {
    res.status(404);
    throw new Error('No Yet Ready');
});

module.exports = {getPackage, purchasePackage, handlePaymentCallback};