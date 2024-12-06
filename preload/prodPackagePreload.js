
const preloadPackage = async () => {
    try {
        const packages = [
            {
                type: 'Topup',
                name: 'HubWallet Cash Topup',
                description: 'Add cash to your wallet to make payments and transfers',
                code: 'tvsgrp0h',
                emailContent: 'You have successfully top-up your HubWallet Cash',
                packageCharge: 0
            },
            {
                type: 'VIP',
                name: 'HUB GIFT PACK (MEN)',
                description: 'Become a RewardHub VIP and get merchandise for men',
                price: '25000',
                code: 'VIP1',
                emailContent: 'Thank you for purchasing HUB GIFT PACK (MEN), we wish you a pleasant journey in using RewardsHub to spend & earn',
                packageCharge: 0
            },
            {
                type: 'VIP',
                name: 'HUB GIFT PACK (WOMEN)',
                description: 'Become a RewardHub VIP and get merchandise for women',
                price: '25000',
                code: 'VIP2',
                emailContent: 'Thank you for purchasing HUB GIFT PACK (WOMEN), we wish you a pleasant journey in using RewardsHub to spend & earn',
                packageCharge: 0
            },
            {
                type: 'VIP',
                name: 'HUB GIFT PACK (MEN) 2',
                description: 'Become a RewardHub VIP and get merchandise for men',
                price: '25000',
                code: 'VIP3',
                emailContent: 'Thank you for purchasing HUB GIFT PACK (MEN) 2, we wish you a pleasant journey in using RewardsHub to spend & earn',
                packageCharge: 0
            },
            {
                type: 'VIP',
                name: 'HUB GIFT PACK (WOMEN) 2',
                description: 'Become a RewardHub VIP and get merchandise for women',
                price: '25000',
                code: 'VIP4',
                emailContent: 'Thank you for purchasing HUB GIFT PACK (WOMEN) 2, we wish you a pleasant journey in using RewardsHub to spend & earn',
                packageCharge: 0
            }
        ];
        // Loop through packages and add them to the database if they don't already exist
        for (const packageData of packages) {
            const existingPackage = await Package.findOne({name: packageData.name});
            if (!existingPackage) {
                const createdPackage = await Package.create(packageData);
                console.log(`✅ Successfully created package: ${createdPackage.name}`);
            } else {
                console.log(`⚠️ Package already exists: ${existingPackage.name}`);
            }
        }
    } catch (error) {
        console.error('❌ Error preloading packages:', error.message);
    } finally {
        process.exit(); // Exit the script when done
    }
};

module.exports = preloadPackage;