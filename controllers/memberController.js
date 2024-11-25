const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const qrcode = require('qrcode');
const Member = require('../models/memberModel');

// @desc    Register new member
// @route   POST /api/member/register
// @access  Public
const registerMember = asyncHandler(async (req, res) => {
    const {fullName, email, password, phone, referredBy} = req.body;

    if (!fullName || !email || !password || !phone) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    // Check if fullName contains numbers and reject if true
    if (/\d/.test(fullName)) {
        res.status(400);
        throw new Error('Full name cannot contain numbers');
    }

    // Check if member is already registered
    const memberExist = await Member.findOne({email});

    if (memberExist) {
        res.status(400);
        throw new Error('Email is already in use');
    }

    // Password hashing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Find referrer by referralCode if provided
    let referrer = null;
    if (referredBy) {
        referrer = await Member.findOne({referralCode: referredBy});
        if (!referrer) {
            res.status(400);
            throw new Error('Invalid referral code');
        }
    }

    // Generate Payment Code
    let isPaymentCodeUnique = false;
    let paymentCode;
    while (!isPaymentCodeUnique) {
        paymentCode = "payment://" + generatePaymentCode(); // Generate a new payment code

        // Check if the payment code already exists in the database
        const existingPaymentCode = await Member.findOne({paymentCode});

        if (!existingPaymentCode) {
            isPaymentCodeUnique = true; // If no existing member found, the code is unique
        }
    }

    // Generate Referral Code
    let isReferralCodeUnique = false;
    let memberReferralCode;
    while (!isReferralCodeUnique) {
        memberReferralCode = generateReferralCode(fullName); // Generate a new referral code

        // Check if the referral code already exists in the database
        const existingReferralCode = await Member.findOne({referralCode: memberReferralCode});

        if (!existingReferralCode) {
            isReferralCodeUnique = true; // If no existing member found, the code is unique
        }
    }

    // Create Member
    const member = await Member.create({
        fullName,
        email,
        password: hashedPassword,
        phone,
        paymentCode,
        referredBy: referrer ? referrer._id : null,
        referralCode: memberReferralCode
    });

    if (member) {// If there is a referrer, add the new member to their referral list
        if (referrer) {
            // Find the level 1 entry (without referrerId for direct upline)
            let levelEntry = referrer.referrals.find(entry => entry.level === "1");

            // If no level entry for level 1, create one
            if (!levelEntry) {
                levelEntry = {
                    level: "1",
                    referrals: [{
                            memberId: member._id, // Only the memberId is required for Level 1
                            referredAt: Date.now()
                        }]
                };
                referrer.referrals.push(levelEntry);
            }

            // Debugging: log what we added to Level 1 referrals
            console.log(``);
            console.log(`Added ${member.fullName} to ${referrer.fullName}'s Level 1 referrals`);

            // Save the referrer with the new referral added
            await referrer.save();

            // Propagate referrals up to 20 levels (starting from Level 2)
            let currentReferrer = referrer.referredBy
                    ? await Member.findById(referrer.referredBy)
                    : null;
            let currentLevel = 2; // Start at Level 2 since Level 1 is already handled

            while (currentReferrer && currentLevel <= 20) {
                const levelString = currentLevel.toString();

                let parentLevelEntry = currentReferrer.referrals.find(
                        entry => entry.level === levelString
                );

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

                await currentReferrer.save();
                console.log(`Added ${referrer.fullName} to ${currentReferrer.fullName}'s Level ${currentLevel} referrals`);

                // Move up the referral chain, updating the referrer for the next level
//                referrer = currentReferrer;
                currentReferrer = currentReferrer.referredBy
                        ? await Member.findById(currentReferrer.referredBy)
                        : null;

                currentLevel++;
            }
        }


        res.status(201).json({
            _id: member._id,
            fullName: member.fullName,
            email: member.email,
            phone: member.phone,
            referralCode: member.referralCode,
            referredBy: referrer ? referrer.referralCode : null,
            token: generateToken(member._id)
        });
    } else {
        res.status(400);
        throw new Error('Invalid member data');
    }
});

// @desc    Authenticate a member
// @route   POST /api/member/login
// @access  Public
const loginMember = asyncHandler(async (req, res) => {
    const {email, password, phone} = req.body;

    // Check user email/phone
    let member = null;
    if (email) {
        member = await Member.findOne({email});
    } else if (phone) {
        member = await Member.findOne({phone});
    } else {
        res.status(400);
        throw new Error('Email or phone required');
    }

    if (member && (await bcrypt.compare(password, member.password))) {
        res.json({
            _id: member._id,
            fullName: member.fullName,
            email: member.mail,
            phone: member.phone,
            referralCode: member.referralCode,
            token: generateToken(member._id)
        });
    } else {
        res.status(400);
        throw new Error('Invalid credentials');
    }
});

// @desc    Update member data
// @route   GET /api/member/update
// @access  Private
const updateMember = asyncHandler(async (req, res) => {
    // Remove restricted fields
    const {_id, createdAt, updatedAt, paymentCode, referralCode, ...updates} = req.body;


    // Check if the referral code is being updated
    if (updates.referredBy) {
        // Check if referralBy is already set, and prevent changes if it's already assigned
        if (req.member.referredBy && req.member.referredBy !== updates.referredBy) {
            res.status(400);
            throw new Error('Referral code cannot be changed once it is assigned');
        }

        // Find the referrer
        const referrer = await Member.findOne({referralCode: updates.referredBy});

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
        if (buffer.length > 2 * 1024 * 1024) { // 2MB limit
            res.status(400);
            throw new Error('Image size must be less than 2MB');
        }
    }

    // Password hashing
    if (updates.password) {
        // Validate password strength (min 8 characters, max 20 characters, include at least 1 uppercase and 1 number)
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,20}$/;
        if (!passwordRegex.test(updates.password)) {
            res.status(400);
            throw new Error('Password must be between 8 and 20 characters, and include at least one uppercase letter and one number');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(updates.password, salt);
        updates.password = hashedPassword;
    }

    console.log(req.body);

    const updatedMember = await Member.findByIdAndUpdate(req.member._id, updates, {
        new : true,
        runValidators: true // Ensures schema validation is applied
    });
    res.status(200).json(updatedMember);
});

// @desc    Get member data
// @route   GET /api/member/me
// @access  Private
const getMember = asyncHandler(async (req, res) => {
    // Exclude the paymentCode field from the response
    const {paymentCode, referrals, ...memberData} = req.member.toObject();

    res.status(200).json(memberData);
});

const inviteMember = asyncHandler(async (req, res) => {
    res.status(200).json(req.member);
});


const genQRCode = asyncHandler(async (req, res) => {
    // Extract only the paymentCode from the member data
    const {paymentCode, fullName} = req.member.toObject();

    // Generate QR code as a Base64 string
    try {
        // Generates the QR code as a Data URL
        const qrCodeBase64 = await qrcode.toDataURL(paymentCode);

        // Return the QR code in the response
        res.status(200).json({qrCode: qrCodeBase64});
    } catch (error) {
        res.status(500).json({message: 'Error generating QR code', error: error.message});
    }
});

// @desc    Get referral members under a specific referral code
// @route   GET /api/member/referral
// @access  Private
const getReferral = asyncHandler(async (req, res) => {
    try {
        // Find the member and populate referrals at each level
        const member = await Member.findById(req.member._id)
                .populate({
                    path: 'referrals.referrals.memberId', // Populate memberId for nested referrals
                    select: 'fullName' // Select only the fullName of referred members
                })
                .populate({
                    path: 'referrals.referrals.referrerId', // Populate referrerId for nested referrals (Level 2 and beyond)
                    select: 'fullName' // Select only the fullName of referrers
                });

        if (!member) {
            res.status(404);
            throw new Error('Member not found');
        }

        // Construct the referral tree structure
        const referralData = {
            fullName: member.fullName,
            referrals: []
        };

        // Iterate through each level of referrals
        member.referrals.forEach(levelEntry => {
            levelEntry.referrals.forEach(referral => {
                let referrer;
                let memberFullName;
                if (levelEntry.level.toString() === "1") {
                    referrer = member._id;
                    memberFullName = member.fullName;
                } else {
                    referrer = referral.referrerId ? referral.referrerId.fullName : 'Unknown Referrer';
                    memberFullName = referral.memberId ? referral.memberId.fullName : 'Unknown Member';

                }
                const referredAt = referral.referredAt;

                // Find or create a referrer entry in the tree
                let referrerNode = referralData.referrals.find(r => r.referrerId === referrer);

                if (!referrerNode) {
                    referrerNode = {
                        referrerId: referrer,
                        referrals: []
                    };
                    referralData.referrals.push(referrerNode);
                }

                // Add the referral details for this referrer
                referrerNode.referrals.push({
                    level: levelEntry.level,
                    memberId: memberFullName,
                    referredAt: referredAt
                });
            });
        });

        // Return the formatted response
        res.status(200).json(referralData);
    } catch (error) {
        res.status(500).json({message: 'Error retrieving referral details', error: error.message});
    }
});



// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({id}, process.env.JWT_SECRET, {
        expiresIn: '1d'
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

module.exports = {registerMember, loginMember, updateMember, getMember, inviteMember, genQRCode, getReferral};