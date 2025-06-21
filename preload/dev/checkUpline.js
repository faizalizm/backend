
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv').config({path: path.join(__dirname, '..', '..', '.env')});
const colors = require('colors');

const {connectDB} = require('../../services/mongodb');
const Member = require('../../models/memberModel'); // adjust path as needed

// Connect to the database
connectDB();

async function getUplineReferralCodes(startMemberId) {
    const referralCodes = [];
    const visited = new Set();
    let currentId = startMemberId;
    let level = 0;

    while (currentId && level < 21) {
        const member = await Member.findOne({ _id: currentId }).select('fullName userName referralCode referredBy');
        if (level == 0){
            console.log(`VIP Upgrade User : ${member.referralCode} - ${member.fullName} - ${member.userName}`);
        }

        if (!member || visited.has(String(member._id))) {
            break;
        }

        visited.add(String(member._id));

        referralCodes.push(member.referralCode);
        console.log(`Level ${level} : ${member.referralCode} - ${member.fullName} - ${member.userName}`);

        currentId = member.referredBy;
        level++;
    }

    return referralCodes;
}

(async () => {
    const startMemberId = '6854f5e54722e6a7d0d98597';
    const uplines = await getUplineReferralCodes(startMemberId);
    process.exit(); // Exit the script when done
})();

