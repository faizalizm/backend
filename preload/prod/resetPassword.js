const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv').config({path: path.join(__dirname, '..', '..', '.env')});
const colors = require('colors');
const bcrypt = require('bcryptjs');

const {connectDB} = require('../../services/mongodb');
const Member = require('../../models/memberModel');

// Connect to the database
//connectDB();


const generatePassword = () => {
    const length = 10;
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
};

const resetPassword = async (emails) => {
    await connectDB();

    console.log('🚀 Starting reset password process...'.blue);
    try {

        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            res.status(400);
            throw new Error('Please provide an array of emails');
        }

        for (const email of emails) {
            console.log(`Resetting password : ${email}`);
            // Check user email
            let member = await Member.findOne({email}, {phone: 1, email: 1, isDeleted: 1});
            if (!member) {
                console.error('❌ Member not found');
                continue;
            }

            // Check if member is not deleted
            if (member.isDeleted) {
                console.error('❌ Member account is already deleted');
                continue;
            }

            const password = generatePassword();
            console.log(`Generated new password : ${password}`);

            // Validate password strength (min 8 characters, max 20 characters, include at least 1 uppercase and 1 number)
            const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,20}$/;
            if (!passwordRegex.test(password)) {
                console.error('❌ Password must be between 8 and 20 characters, and include at least one uppercase letter and one number');
                continue;
            }

            // Password hashing
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            member.password = hashedPassword;
            await member.save();

            console.log(`✅ Reset password success for ${email}`);
        }
    } catch (error) {
        console.error('❌ Error in password reset:', error.message);
    } finally {
        process.exit(); // Exit the script when done
    }
};

resetPassword(["contact@faizalismail.com", "nurmin199362@gmail.com"]);
