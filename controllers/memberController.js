const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const { logger } = require('../services/logger');
const { sendMail } = require('../services/nodemailer');
const { setTokenOnLogin } = require('../services/firebaseCloudMessage');
const { resizeImage } = require('../services/sharp');

const Member = require('../models/memberModel');
const Wallet = require('../models/walletModel');
const Otp = require('../models/otpModel');

const registerMember = asyncHandler(async (req, res) => {
    let { userName, fullName, email, password, phone, referredBy } = req.body;

    if (!email || !password || !referredBy) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    if (userName && !/^[a-zA-Z0-9_-]+$/.test(userName)) {
        res.status(400);
        throw new Error('Username can only contain letters, numbers, underscores, and dashes');
    }

    // Check if fullName contains numbers and reject if true
    if (fullName && /\d/.test(fullName)) {
        res.status(400);
        throw new Error('Full name cannot contain numbers');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        res.status(400);
        throw new Error('Invalid email format');
    }

    // Check if member is already registered
    logger.info('Fetching member details');
    const orConditions = [
        { email: email.toLowerCase() }, // Check for existing email

    ];

    if (phone) {
        orConditions.push({ phone });
    }
    if (userName) {
        orConditions.push({ userName: userName.toLowerCase() }); // Check for existing username
    }

    const memberDetails = await Member.findOne({
        $or: orConditions
    });

    logger.info('Checking field uniqueness');
    if (memberDetails) {
        if (memberDetails.email === email.toLowerCase()) {
            res.status(400);
            throw new Error('Email has been taken');
        }
        if (phone && memberDetails.phone === phone) {
            res.status(400);
            throw new Error('Phone number has been taken');
        }
        if (userName && memberDetails.userName === userName.toLowerCase()) {
            res.status(400);
            throw new Error('Username has been taken');
        }
    }

    // Validate password strength (min 8 characters, max 20 characters, include at least 1 uppercase and 1 number)
    logger.info('Validating password strength');
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,20}$/;
    if (!passwordRegex.test(password)) {
        res.status(400);
        throw new Error('Password must be between 8 and 20 characters, and include at least one uppercase letter and one number');
    }

    // Password hashing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Find referrer by referralCode if provided
    logger.info('Fetching referrer details');
    let referrer = null;
    if (referredBy) {
        referrer = await Member.findOne({ referralCode: referredBy });
        if (!referrer) {
            res.status(400);
            throw new Error('Invalid referral code');
        }
    }

    // Generate Referral Code
    logger.info('Generating referrer code');
    let refCodeSource = fullName?.trim() ? fullName : userName || 'HUB';
    let isReferralCodeUnique = false;
    let memberReferralCode;
    while (!isReferralCodeUnique) {
        memberReferralCode = generateReferralCode(refCodeSource); // Generate a new referral code

        // Check if the referral code already exists in the database
        const existingReferralCode = await Member.findOne({
            $or: [
                { referralCode: memberReferralCode },
                { userName: memberReferralCode.toLowerCase() }
            ]
        });

        if (!existingReferralCode) {
            isReferralCodeUnique = true; // If no existing member found, the code is unique
        }
    }

    try {
        // Create Member
        logger.info('Creating member');
        const member = await Member.create({
            userName: userName?.toLowerCase() || memberReferralCode,
            fullName,
            email: email.toLowerCase(),
            password: hashedPassword,
            phone,
            referredBy: referrer ? referrer._id : null,
            referralCode: memberReferralCode,
            status: 'Active'
        });

        // Generate Payment Code
        logger.info('Generating payment code');
        let isPaymentCodeUnique = false;
        let paymentCode;
        while (!isPaymentCodeUnique) {
            paymentCode = "payment://" + generatePaymentCode(); // Generate a new payment code

            // Check if the payment code already exists in the database
            const existingPaymentCode = await Wallet.findOne({ paymentCode });

            if (!existingPaymentCode) {
                isPaymentCodeUnique = true; // If no existing member found, the code is unique
            }
        }

        logger.info('Creating wallet');
        const wallet = await Wallet.create({
            memberId: member._id,
            balance: 0,
            currency: 'MYR',
            paymentCode
        });

        if (member) {// If there is a referrer, add the new member to their referral list
            if (referrer) {
                // Find the level 1 entry (without referrerId for direct upline)
                let levelEntry = referrer.referrals.find(entry => entry.level === "1");

                const newReferral = {
                    referrerId: referrer._id,
                    memberId: member._id,
                    referredAt: Date.now()
                };

                if (!levelEntry) {
                    // Create the level entry if it doesn't exist
                    levelEntry = {
                        level: "1",
                        referrals: [newReferral]
                    };
                    referrer.referrals.push(levelEntry);
                } else {
                    // Append new member to the existing referrals list
                    levelEntry.referrals.push(newReferral);
                }

                logger.info(`Added ${member.email} to ${referrer.email}'s Level 1 referrals`);

                // Update referralStats for level 1
                const level1Stats = referrer.referralStats.find(stat => stat.level === 1);
                if (level1Stats) {
                    level1Stats.user += 1;
                } else {
                    referrer.referralStats.push({
                        level: 1,
                        user: 1,
                        vip: 0
                    });
                }
                // Save the referrer with the new referral added
                await referrer.save();

                // Propagate referrals up to 20 levels (starting from Level 2)
                let currentReferrer = referrer.referredBy
                    ? await Member.findById(referrer.referredBy)
                    : null;
                let currentLevel = 2; // Start at Level 2 since Level 1 is already handled

                while (currentReferrer && currentLevel <= 20) {
                    const levelString = currentLevel.toString();

                    let parentLevelEntry = currentReferrer.referrals.find(entry => entry.level === levelString);

                    if (!parentLevelEntry) {
                        parentLevelEntry = {
                            level: levelString,
                            referrals: [{
                                referrerId: referrer._id, // Add referrerId for higher levels
                                memberId: member._id,
                                referredAt: Date.now()
                            }]
                        };
                        currentReferrer.referrals.push(parentLevelEntry);
                    } else {
                        const referrals = {
                            referrerId: referrer._id, // Add referrerId for higher levels
                            memberId: member._id,
                            referredAt: Date.now()
                        };
                        parentLevelEntry.referrals.push(referrals);
                    }

                    const statsEntry = currentReferrer.referralStats.find(stat => stat.level === currentLevel);
                    if (statsEntry) {
                        statsEntry.user += 1;
                    } else {
                        currentReferrer.referralStats.push({
                            level: currentLevel,
                            user: 1,
                            vip: 0
                        });
                    }
                    await currentReferrer.save();

                    logger.info(`Added ${referrer.email} to ${currentReferrer.email}'s Level ${currentLevel} referrals`);

                    // Move up the referral chain, updating the referrer for the next level
                    //                referrer = currentReferrer;
                    currentReferrer = currentReferrer.referredBy
                        ? await Member.findById(currentReferrer.referredBy)
                        : null;

                    currentLevel++;
                }
            }


            res.status(201).json({
                fullName: member.fullName,
                email: member.email,
                phone: member.phone,
                referralCode: member.referralCode,
                referredBy: referrer ? referrer.referralCode : null
            });
        } else {
            res.status(400);
            throw new Error('Invalid Member Data');
        }
    } catch (error) {
        res.status(500);
        throw new Error(`Registration Failed ${error}`);
    }
});

const loginMember = asyncHandler(async (req, res) => {
    const { type, email, password, phone, refreshToken, fcmToken } = req.body;

    try {
        logger.info(`Login Type : ${type}`);
        if (type === 'biometric') {
            logger.info('Fetching member details');
            const member = await Member.findOne({ refreshToken });
            if (!member) {
                res.status(400);
                throw new Error('Biometric authentication fail, please proceed with password login');
            } else if (member.email != email) {
                res.status(400);
                throw new Error('Email changed, kindly relogin to enable biometric');
            } else if (member.status === 'Deleted') {
                throw new Error('Member not found');
            } else if (member.status === 'Deactivated') {
                throw new Error('Account deactivated, please contact support for assistance');
            }

            if (fcmToken) {
                logger.info('Saving FCM token');
                await setTokenOnLogin(member, fcmToken);
            }

            logger.info('Generating new refresh token');
            const newRefreshToken = generateToken(member._id, process.env.REFRESH_TOKEN_EXPIRY);
            member.refreshToken = newRefreshToken;
            await member.save();

            res.status(200).json({
                fullName: member.fullName,
                userName: member.userName,
                referralCode: member.referralCode,
                type: member.type,
                token: generateToken(member._id, process.env.ACCESS_TOKEN_EXPIRY),
                refreshToken: newRefreshToken
            });
        } else {
            // Check user email/phone
            logger.info('Fetching member details');
            let member = null;
            if (email) {
                member = await Member.findOne({ email: email.toLowerCase() });
            } else if (phone) {
                member = await Member.findOne({ phone });
            } else {
                res.status(400);
                throw new Error('Email or phone required');
            }

            if (!member) {
                logger.warn('Member not found');
                res.status(400);
                throw new Error('Invalid credentials');
            } else if (member.status === 'Deleted') {
                throw new Error('Member not found');
            } else if (member.status === 'Deactivated') {
                throw new Error('Account deactivated, please contact support for assistance');
            }

            logger.info('Validating password');
            if (await bcrypt.compare(password, member.password)) {

                if (fcmToken) {
                    logger.info('Saving FCM token');
                    await setTokenOnLogin(member, fcmToken);
                }

                logger.info('Generating new refresh token');
                const newRefreshToken = generateToken(member._id, process.env.REFRESH_TOKEN_EXPIRY);
                member.refreshToken = newRefreshToken;
                await member.save();

                res.status(200).json({
                    fullName: member.fullName,
                    userName: member.userName,
                    referralCode: member.referralCode,
                    type: member.type,
                    token: generateToken(member._id, process.env.ACCESS_TOKEN_EXPIRY),
                    refreshToken: newRefreshToken
                });
            } else {
                logger.warn('Invalid password');
                res.status(400);
                throw new Error('Invalid credentials');
            }
        }
    } catch (error) {
        res.status(500);
        throw error;
    }
});

const getOtp = asyncHandler(async (req, res) => {
    const { email, phone } = req.query;

    if (!email && !phone) {
        res.status(400);
        throw new Error('Email or phone is required');
    }

    try {
        const query = {};
        if (email) {
            logger.info('Validating email');
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (email && !emailRegex.test(email)) {
                res.status(400);
                throw new Error('Invalid email format');
            }

            query.email = email;
        }
        if (phone)
            query.phone = phone;

        logger.info('Fetching most recent OTP');
        const lastOtp = await Otp.findOne(query).sort({ createdAt: -1 }); // Get the most recent OTP

        if (lastOtp) {
            logger.info('Validating OTP cooldown');
            const now = new Date();
            const lastSent = new Date(lastOtp.createdAt);
            const interval = 2 * 60 * 1000; // 2 minutes in milliseconds

            // Calculate the time difference between the current time and the last OTP sent time
            const timeDifference = now - lastSent;

            // If the time difference is less than the interval, calculate the remaining time
            if (timeDifference < interval) {
                const remainingTime = interval - timeDifference;
                const remainingSeconds = Math.floor(remainingTime / 1000); // Convert to seconds

                res.status(429);
                throw new Error(`Please wait ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''} before requesting another OTP`);
            }
        }

        // Generate OTP
        logger.info('Generating OTP');
        const minutesAfterExpiry = 5;
        const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
        const otpExpiry = new Date(Date.now() + minutesAfterExpiry * 60 * 1000); // 5 minutes from now
        logger.info(`Email : ${email}, OTP : ${otp}, Expiry : ${otpExpiry}`);

        // Save OTP
        logger.info('Creating OTP');
        const createdOtp = await Otp.create({ email, phone, otp, otpExpiry });

        if (email) {
            logger.info('Sending OTP via email');
            await sendOtpEmail(email, otp, minutesAfterExpiry, otpExpiry);
        }

        res.status(200).json({
            //            otp, // Remove in production for security reasons
            expiry: otpExpiry
        });
    } catch (error) {
        res.status(500);
        throw error;
    }
});

const deleteMember = asyncHandler(async (req, res) => {
    const { email, password, otp } = req.body;

    if (!email || !password || !otp) {
        res.status(400);
        throw new Error('Please provide all details');
    }

    // Check user email
    logger.info('Fetching member details');
    let member = await Member.findOne({ email }, { password: 1, phone: 1, email: 1, isDeleted: 1 });
    if (!member) {
        res.status(404);
        throw new Error('Invalid credentials');
    }

    // Check if member is not deleted
    logger.info('Checking if member deleted previously');
    if (member.isDeleted) {
        res.status(400);
        throw new Error('Member account is already deleted');
    }

    // Find from OTP list
    logger.info('Fetching most recent OTP');
    const lastOtp = await Otp.findOne({ email }).sort({ createdAt: -1 }); // Get the most recent OTP
    if (!lastOtp) {
        res.status(404);
        throw new Error('No OTP found for this email');
    }

    // Check OTP expiry
    logger.info('Validating OTP expiration');
    const now = new Date();
    const otpExpiry = new Date(lastOtp.otpExpiry);
    if (now > otpExpiry) {
        res.status(400);
        throw new Error('OTP has expired');
    }

    logger.info('Validating OTP');
    if (otp !== lastOtp.otp) {
        res.status(400);
        throw new Error('OTP is invalid');
    }

    logger.info('Validating password');
    if (await bcrypt.compare(password, member.password)) {
        logger.info('Deleting member details');
        // Mark as deleted
        member.fullName = null;
        member.userName = null;
        member.email = null;
        member.phone = null;
        member.withdrawalDetails = null;
        member.shippingDetails = null;
        member.isDeleted = true;
        await member.save();

        res.status(200).json({});
    } else {
        res.status(400);
        throw new Error('Invalid credentials');
    }
});

const resetPassword = asyncHandler(async (req, res) => {
    try {
        const { email, password, otp } = req.body;

        if (!email || !password || !otp) {
            res.status(400);
            throw new Error('Please provide email, password and OTP');
        }

        // Check user email
        logger.info('Fetching member details');
        let member = await Member.findOne({ email }, { phone: 1, email: 1, isDeleted: 1 });
        if (!member) {
            res.status(404);
            throw new Error('Member not found');
        }

        // Find from OTP list
        logger.info('Fetching most recent OTP');
        const lastOtp = await Otp.findOne({ email }).sort({ createdAt: -1 }); // Get the most recent OTP
        if (!lastOtp) {
            res.status(400);
            throw new Error('OTP is invalid');
        }

        // Check OTP expiry
        logger.info('Validating OTP expiration');
        const now = new Date();
        const otpExpiry = new Date(lastOtp.otpExpiry);
        if (now > otpExpiry) {
            res.status(400);
            throw new Error('OTP has expired, kindly request a new one');
        }

        logger.info('Validating OTP');
        if (otp !== lastOtp.otp) {
            res.status(400);
            throw new Error('OTP is invalid');
        }

        // Validate password strength (min 8 characters, max 20 characters, include at least 1 uppercase and 1 number)
        logger.info('Validating password strength');
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,20}$/;
        if (!passwordRegex.test(password)) {
            res.status(400);
            throw new Error('Password must be between 8 and 20 characters, and include at least one uppercase letter and one number');
        }

        // Password hashing
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        member.password = hashedPassword;
        await member.save();

        res.status(200).json({ message: 'Password has been reset successfully' });
    } catch (error) {
        res.status(500);
        throw error;
    }
});

const getMember = asyncHandler(async (req, res) => {
    try {
        logger.info('Fetching member details');
        const member = await Member.findById(req.member._id, { _id: 0, password: 0, referrals: 0, __v: 0 }).lean();

        if (!req.member.referredBy) {
            member.referredBy = 'Not Set';
        } else {
            logger.info('Fetching referrer details');
            const referrer = await Member.findOne({ _id: req.member.referredBy }, { _id: 0, fullName: 1, userName: 1 }).lean();;
            if (referrer) {
                member.referredBy = referrer
                    ? (referrer.userName?.trim() || referrer.fullName || 'Unknown')
                    : 'Unknown';
            }
        }

        if (member.profilePicture) {
            logger.info('Resizing packages picture');
            member.profilePicture.picture = await resizeImage(member.profilePicture, process.env.IMAGE_WIDTH_MEMBER_PROFILE, process.env.IMAGE_QUALITY_MEMBER_PROFILE);
        }

        res.status(200).json(member);
    } catch (error) {
        res.status(500);
        throw error;
    }
});

const updateMember = asyncHandler(async (req, res) => {
    // Remove restricted fields
    const { _id, createdAt, updatedAt, referralCode, type, ...updates } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (updates.email && !emailRegex.test(updates.email)) {
        res.status(400);
        throw new Error('Invalid email format');
    }

    // Check for withdrawal details
    const currentWithdrawalDetails = req.member.withdrawalDetails || {};
    const withdrawalDetails = { ...currentWithdrawalDetails };
    if (updates.withdrawalDetails?.bankDetails) {
        const { bankName, bankAccountName, bankAccountNumber } = updates.withdrawalDetails.bankDetails;
        if (!bankName || !bankAccountName || !bankAccountNumber) {
            res.status(400);
            throw new Error('Please provide all bank details');
        }
        withdrawalDetails.bankDetails = {
            bankName,
            bankAccountName,
            bankAccountNumber
        };
    }

    if (Object.keys(withdrawalDetails).length) {
        updates.withdrawalDetails = withdrawalDetails;
    }

    // Check if the referral code is being updated
    if (updates.referredBy) {
        // Check if referralBy is already set, and prevent changes if it's already assigned
        if (req.member.referredBy && req.member.referredBy !== updates.referredBy) {
            res.status(400);
            throw new Error('Referral code cannot be changed once it is assigned');
        }

        // Find the referrer
        logger.info('Fetching referrer details');
        const referrer = await Member.findOne({ referralCode: updates.referredBy });

        // Check if the referral code exists
        if (!referrer) {
            res.status(400);
            throw new Error('Invalid referral code');
        }

        // Update the member's referral code and the referral relationship
        updates.referredBy = referrer.referralCode;

        // Add the member to the new referrer's referral list
        referrer.referrals.push({
            memberId: req.member._id,
            referredBy: referrer._id,
            referredAt: Date.now(),
            level: 1 // Start from level 1 for the direct referral
        });
        await referrer.save();

        // Propagate upwards and add the new member to the referral chain
        let currentReferrer = referrer;
        let currentLevel = 2; // Start from level 2 for indirect referrals

        while (currentReferrer && currentLevel <= 20) {
            // Add the new member to the current referrer's referral list at the appropriate level
            currentReferrer.referrals.push({
                memberId: req.member._id, // Current member doing profile update
                referredBy: referrer._id, // Make sure we link to the correct referrer
                referredAt: Date.now(),
                level: currentLevel
            });

            // Save the current referrer
            await currentReferrer.save();

            // Move to the next referrer (parent referrer)
            currentReferrer = currentReferrer.referredBy ? await Member.findById(currentReferrer.referredBy) : null;
            currentLevel++;
        }
    }

    // Check if the profile picture exists
    if (updates.profilePicture) {
        // Check if the base64 string is in the correct format (data:image/png;base64 or data:image/jpeg;base64)
        logger.info('Validating profile picture format');
        const regex = /^data:image\/(jpg|jpeg|png);base64,/;
        if (!regex.test(updates.profilePicture)) {
            res.status(400);
            throw new Error('Image must be in JPG, JPEG, or PNG format');
        }

        // Extract the base64 data by removing the header
        const base64Data = updates.profilePicture.split(',')[1];

        // Convert base64 data to buffer to check size
        const buffer = Buffer.from(base64Data, 'base64');

        // Check if the image size is within 2MB limit
        logger.info('Validating profile picture size');
        if (buffer.length > 2 * 1024 * 1024) { // 2MB limit
            res.status(400);
            throw new Error('Image size must be less than 2MB');
        }
    }

    // Password hashing
    if (updates.password) {
        // Validate password strength (min 8 characters, max 20 characters, include at least 1 uppercase and 1 number)
        logger.info('Validating password strength');
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,20}$/;
        if (!passwordRegex.test(updates.password)) {
            res.status(400);
            throw new Error('Password must be between 8 and 20 characters, and include at least one uppercase letter and one number');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(updates.password, salt);
        updates.password = hashedPassword;
    }
    try {
        logger.info('Updating member details');
        const updatedMember = await Member.findByIdAndUpdate(req.member._id, updates, {
            new: true,
            runValidators: true // Ensures schema validation is applied
        }).select('-_id -vipAt -createdAt -updatedAt -__v -referrals -referredBy -referralCode -type -password');
        res.status(200).json(updatedMember);
    } catch (error) {

        if (error.code === 11000) {
            const duplicateField = Object.keys(error.keyValue)[0];
            logger.warn(`Duplicate field: ${duplicateField}`);
            res.status(400);
            throw new Error(`${duplicateField} has been taken`);
        }

        res.status(400);
        throw error;
    }
});

const inviteMember = asyncHandler(async (req, res) => {
    const { email, phone } = req.body;

    if (!email && !phone) {
        res.status(400);
        throw new Error('Email or phone is required for invitation');
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400);
        throw new Error('Invalid email format');
    }

    if (phone && !/^\+?[1-9]\d{1,14}$/.test(phone)) {
        res.status(400);
        throw new Error('Invalid phone number format');
    }

    if (!req.member.referralCode) {
        res.status(500);
        throw new Error('Referral code is missing');
    }

    const sanitizedEmail = email?.trim();
    const sanitizedPhone = phone?.trim();
    if (sanitizedEmail === req.member?.email || sanitizedPhone === req.member?.phone) {
        res.status(400);
        throw new Error('Could not invite yourself');
    }

    const appPackage = process.env.APP_PACKAGE;
    const playStoreInvitation = `https://play.google.com/store/apps/details?id=${appPackage}&hl=en&pli=1&ref=${req.member.referralCode}`;
    logger.info(`Invitation link : ${playStoreInvitation}`);

    if (email) {
        // Send the invitation email (Asynchronously)
        logger.info('Sending invitation via email');
        sendInvitationEmail(sanitizedEmail, req.member.referralCode, playStoreInvitation);
    }

    // Respond with the Play Store invitation link
    res.status(200).json({ invitationLink: playStoreInvitation });
});

const getReferral = asyncHandler(async (req, res) => {
    const { level } = req.query;

    if (!level) {
        return res.status(400).json({ message: "Level is required" });
    }

    try {
        // Find the member based on their ID
        logger.info('Fetching member details');
        const member = await Member.findById(req.member._id);

        if (!member) {
            return res.status(404).json({ message: "Member not found" });
        }

        const referralsForLevel = member.referrals.find(referral => referral.level === level);

        if (!referralsForLevel) {
            return res.status(404).json({ message: `No referrals found for level ${level}` });
        }

        const populatedReferrals = await Promise.all(referralsForLevel.referrals.map(async (referral) => {

            logger.info('Fetching referrer details');
            const populatedReferrer = await Member.findById(referral.referrerId).select('fullName type vipAt createdAt -_id');
            logger.info('Fetching member details');
            const populatedMember = await Member.findById(referral.memberId).select('fullName type vipAt createdAt -_id');

            return {
                referrer: populatedReferrer,
                member: populatedMember,
                createdAt: referral.createdAt
            };
        }));

        // Group referrals by referrer full name and type
        const groupedReferrals = populatedReferrals.reduce((acc, { referrer, member }) => {
            const referrerKey = `${referrer.fullName}-${referrer.type}`;  // Unique key combining full name and type

            // If the referrer already exists in the map, add the member to the list
            if (acc[referrerKey]) {
                acc[referrerKey].push(member);
            } else {
                // If not, create a new list for this referrer
                acc[referrerKey] = [member];
            }

            return acc;
        }, {});

        // Convert the grouped referrals into the desired structure
        const modifiedReferralList = Object.keys(groupedReferrals).map(referrerKey => {
            const [fullName, type] = referrerKey.split('-');  // Split the referrerKey back to fullName and type
            return {
                referrer: {
                    fullName,
                    type // Add the actual type from the referrer object
                    // You can add other referrer fields if necessary, like profile picture or VIP status
                },
                members: groupedReferrals[referrerKey]
            };
        });
        return res.status(200).json({ referrals: modifiedReferralList });
    } catch (error) {
        logger.error(`${error}`);
        return res.status(500).json({ message: "An error occurred while retrieving referrals" });
    }
});

const getVIPStatistic = asyncHandler(async (req, res) => {
    try {
        logger.info('Fetching total live VIP');
        const totalLiveVIP = await getTotalLiveVIP();

        logger.info('Fetching recent VIP');
        const recentVip = await getRecentVIP();

        res.status(200).json({
            totalLiveVIP,
            recentVip
        });
    } catch (error) {
        res.status(500);
        throw error;
    }
});

const getTotalLiveVIP = async () => {
    try {
        return await Member.countDocuments({ type: 'VIP' });
    } catch (error) {
        logger.error(`Error getting total Live VIP : ${error.message}`);
        return null;
    }
};

const getRecentVIP = async () => {
    try {
        //        const period = 48; // 48 hours ago
        //        const recentPeriod = new Date(Date.now() - period * 60 * 60 * 1000);

        return await Member.find(
            {
                type: 'VIP'
                //                    vipAt: {$gte: recentPeriod}}, // Filter by vipAt >= 48 hours ago}, // Match members with type VIP
            },
            {
                // profilePicture: 1,
                fullName: 1,
                vipAt: 1,
                _id: 0 // Exclude the _id field
            }
        )
            .sort({ vipAt: -1 }) // Sort by vipAt in descending order (most recent first)
            .limit(30);

    } catch (error) {
        logger.error(`Error getting recent VIP : ${error.message}`);
        return null;
    }
};

// Generate JWT Token
const generateToken = (id, expiry) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: expiry
    });
};

// Generate Payment Code
const generatePaymentCode = () => {
    const length = 64;
    const randomString = crypto.randomBytes(length).toString('base64').slice(0, length); // Generate a 64-character base64 string
    return randomString.replace(/\+/g, '0').replace(/\//g, '1'); // Replace unsafe characters to avoid issues
};

// Generate a referral code
const generateReferralCode = (fullName) => {
    // Remove any non-alphabetic characters (such as numbers and special characters)
    const cleanedName = fullName.replace(/[^A-Za-z]/g, '');

    // Take the first 6 characters of the cleaned name (in uppercase)
    const namePart = cleanedName.substring(0, 3).toUpperCase();

    // Generate 3 random digits
    const randomDigits = Math.floor(1000 + Math.random() * 9000);  // 3 random digits between 1000 and 9999

    const referralCode = namePart + randomDigits;
    return referralCode;
};

const sendInvitationEmail = async (recipientEmail, referralCode, playStoreInvitation) => {
    // Fetch and modify HTML template
    const htmlTemplatePath = path.join(__dirname, '..', 'email', 'otpMail.html');
    let htmlContent = fs.readFileSync(htmlTemplatePath, 'utf-8');

    // Replace placeholders with actual data
    htmlContent = htmlContent.replace('${referralCode}', referralCode);
    htmlContent = htmlContent.replace('${playStoreInvitation}', playStoreInvitation);

    let mailId = 'invitation';
    let subject = 'Explore Rewards Hub';
    await sendMail(mailId, subject, htmlContent, recipientEmail);
};

const sendOtpEmail = async (recipientEmail, otp, minutesAfterExpiry, otpExpiry) => {
    // Fetch and modify HTML template
    const htmlTemplatePath = path.join(__dirname, '..', 'email', 'otp.html');
    let htmlContent = fs.readFileSync(htmlTemplatePath, 'utf-8');

    // Replace placeholders with actual data
    htmlContent = htmlContent.replace('${otp}', otp);
    htmlContent = htmlContent.replace('${minutesAfterExpiry}', minutesAfterExpiry);
    //    htmlContent = htmlContent.replace('${otpExpiry}', otpExpiry);

    let mailId = 'otp';
    let subject = 'Reward Hub OTP';
    await sendMail(mailId, subject, htmlContent, recipientEmail);
};


module.exports = {
    registerMember,
    loginMember,
    getOtp,
    deleteMember,
    resetPassword,
    getMember,
    updateMember,
    inviteMember,
    getReferral,
    getVIPStatistic,
};