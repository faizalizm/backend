const crypto = require('crypto');
// Generate and log the JWT secret
const secret = crypto.randomBytes(64).toString('hex');
console.log('Generated JWT_SECRET:', secret);

const axios = require('axios');

const apiUrl = 'http://127.0.0.1:7070/api/v1/member/register';

const registerTopLevelUser = async () => {
    const user = {
        fullName: 'Faizal Ismail',
        email: 'contact@faizal.com',
        password: '12312321',
        phone: '+60165895625',
        referredBy: '' // Root user has no referrer
    };

    return await registerAndGetReferralCode(user);
};

const registerSecondLevelUsers = async (faizalCode) => {
    const user = {
        fullName: 'Ahmad Tenzou',
        email: 'contact@tenzou.com',
        password: '12312321',
        phone: '+60165895625',
        referredBy: faizalCode
    };

    return await registerAndGetReferralCode(user);
};

const registerThirdLevelUsers = async (ahmadCode) => {
    const user = {
        fullName: 'Risalah',
        email: 'contact@risalah.com',
        password: '12312321',
        phone: '+60165895625',
        referredBy: ahmadCode
    };

    return await registerAndGetReferralCode(user);
};

const registerFourthLevelUsers = async (risalahCode) => {
    const users = [
        {
            fullName: 'Mawaddah Zahra',
            email: 'mawaddah@zahra.com',
            password: '12312321',
            phone: '+60165895626',
            referredBy: risalahCode
        },
        {
            fullName: 'Sakinah Rahman',
            email: 'sakinah@rahman.com',
            password: '12312321',
            phone: '+60165895627',
            referredBy: risalahCode
        },
        {
            fullName: 'Amirah Musa',
            email: 'amirah@musa.com',
            password: '12312321',
            phone: '+60165895628',
            referredBy: risalahCode
        }
    ];

    for (const user of users) {
        await registerAndGetReferralCode(user);
    }
};

const registerAndGetReferralCode = async (user) => {
    try {
        const response = await axios.post(apiUrl, user);
        const referralCode = response.data.referralCode;

        console.log(`User ${user.fullName} registered successfully with referral code: ${referralCode}`);
        return referralCode;
    } catch (error) {
        console.error(`Error registering ${user.fullName}:`, error.response ? error.response.data : error.message);
        throw error; // Stop further execution if registration fails
    }
};

const registerAllHierarchies = async () => {
    try {
        console.log("Registering Faizal (root user)");
        const faizalCode = await registerTopLevelUser();

        console.log("Registering users under Faizal");
        const ahmadCode = await registerSecondLevelUsers(faizalCode);

        console.log("Registering users under Ahmad");
        const risalahCode = await registerThirdLevelUsers(ahmadCode);

        console.log("Registering users under Risalah");
        await registerFourthLevelUsers(risalahCode);

        console.log("Registration completed successfully!");
    } catch (error) {
        console.error("Registration process failed:", error.message || error);
    }
};

registerAllHierarchies();

