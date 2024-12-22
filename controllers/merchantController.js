const crypto = require('crypto');
const asyncHandler = require('express-async-handler');

const {logger} = require('../services/logger');

const Member = require('../models/memberModel');
const Merchant = require('../models/merchantModel');
const Wallet = require('../models/walletModel');

const searchMerchant = asyncHandler(async (req, res) => {
    const {field, term} = req.query;

    if (!field || !term) {
        res.status(400);
        throw new Error('Please add field and term');
    }

    // Get the list of valid fields dynamically from the schema
    const validFields = Object.keys(Merchant.schema.paths).filter(
            (fieldName) =>
        fieldName !== '_id' &&
                fieldName !== 'memberId' &&
                fieldName !== 'logo' &&
                fieldName !== 'spendingCode'
    );

    // Check if the provided field is valid
    if (!validFields.includes(field)) {
        res.status(400);
        throw new Error('Invalid search field');
    }

    try {
        const searchQuery = {
            [field]: {$regex: term, $options: 'i'}
        };

        // Perform the search
        const merchants = await Merchant.find(searchQuery, {_id: 0, spendingCode: 0});

        if (merchants.length > 0) {
            res.status(200).json(merchants);
        } else {
            res.status(404);
            throw new Error('No Merchant Found');
        }
    } catch (error) {
        res.status(500);
        throw new Error(error.message || 'Error searching merchants');
    }
});

const getMerchant = asyncHandler(async (req, res) => {
    const merchant = await Merchant.findOne({memberId: req.member._id}, {_id: 0, memberId: 0, spendingCode: 0, __v: 0});

    if (merchant) {
        res.status(200).json(merchant);
    } else {
        res.status(404);
        throw new Error('Merchant not found');
    }
});

const registerMerchant = asyncHandler(async (req, res) => {
    const existingMerchant = await Merchant.findOne({memberId: req.member._id}, {_id: 1});
    if (existingMerchant) {
        res.status(400);
        throw new Error('Merchant already registered');
    }

    // Generate Spending Code
    let isSpendingCodeUnique = false;
    let spendingCode;
    while (!isSpendingCodeUnique) {
        spendingCode = "spend://" + generateSpendingCode(); // Generate new spending code

        // Check if the spending code already exists in the database
        const existingSpendingCode = await Merchant.findOne(
                {spendingCode},
                {_id: 1}
        );
        if (!existingSpendingCode) {
            isSpendingCodeUnique = true; // If no existing merchant found, the code is unique
        }
    }

    try {
        const merchantData = {...req.body, spendingCode, memberId: req.member._id};
        const merchant = await Merchant.create(merchantData);

        res.status(200).json(merchant);
    } catch (error) {
        res.status(400);
        throw new Error(error);
    }
});

const updateMerchant = asyncHandler(async (req, res) => {
    // Remove restricted fields
    const {_id, memberId, createdAt, updatedAt, spendingCode, ...updates} = req.body;

    // Find merchant
    const merchant = await Merchant.findOne({memberId: req.member._id},
            {spendingCode: 0}
    );
    if (!merchant) {
        res.status(404);
        throw new Error('Merchant not found');
    }

    // Update merchant
    try {
        const updatedMerchant = await Merchant.findByIdAndUpdate(merchant._id, updates, {
            new : true,
            runValidators: true // Ensures schema validation is applied
        });

        // Echo updated fields only
        const updatedFields = Object.keys(updates).reduce((acc, key) => {
            if (updatedMerchant[key] !== undefined) {
                acc[key] = updatedMerchant[key];
            }
            return acc;
        }, {});

        res.status(200).json(updatedFields);
    } catch (error) {
        res.status(400);
        throw new Error(error);
    }
});

// Generate Payment Code
const generateSpendingCode = () => {
    const length = 64;
    const randomString = crypto.randomBytes(length).toString('base64').slice(0, length); // Generate a 64-character base64 string
    return randomString.replace(/\+/g, '0').replace(/\//g, '1'); // Replace unsafe characters to avoid issues
};

module.exports = {searchMerchant, getMerchant, registerMerchant, updateMerchant};