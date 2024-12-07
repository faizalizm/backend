const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv').config({path: path.join(__dirname, '..', '..', '.env')});
const colors = require('colors');

const connectDB = require('../../services/mongodb');
const Package = require('../../models/packageModel');

// Connect to the database
connectDB();

const encodeImageToBase64 = (filePath) => {
    try {
        const absolutePath = path.resolve(__dirname, filePath);
        const image = fs.readFileSync(absolutePath);
        const base64Image = image.toString('base64');
        const ext = path.extname(filePath).substring(1); // Get file extension without the dot
        return `data:image/${ext};base64,${base64Image}`;
    } catch (error) {
        console.error(`❌ Error encoding image at ${filePath}:`, error.message);
        return null; // Return null if there's an error
    }
};

const preloadPackage = async () => {
    console.log('🚀 Starting package preload process...'.blue);
    try {
        const packages = [
            {
                type: 'Topup',
                name: 'HubWallet Cash Topup',
                description: ['Add cash to your wallet to make payments and transfers'],
                categoryCode: 'xvzexbil',
                emailContent: 'You have successfully top-up your HubWallet Cash',
                packageCharge: 0
            },
            {
                type: 'VIP',
                picture: encodeImageToBase64('../vip1.jpg'),
                name: 'HUB GIFT PACK (MEN)',
                description: [
                    "1 Box of Hub Fragrance (5 Bottles) worth RM100.00",
                    "1 bottle 35ML worth RM79.00",
                    "1 T-Shirt",
                    "1 Simcard S4S",
                    "1 Prepaid card Mastercard from Mi-Pay",
                    "1 Lucky Draw Ticket"
                ],
                price: '25000',
                code: 'VIP1',
                categoryCode: '5430n0yy',
                emailContent: 'Thank you for purchasing HUB GIFT PACK (MEN), we wish you a pleasant journey in using RewardsHub to spend & earn',
                packageCharge: 0
            },
            {
                type: 'VIP',
                picture: encodeImageToBase64('../vip2.jpg'),
                name: 'HUB GIFT PACK (WOMEN)',
                description: [
                    "1 Box of Hub Fragrance (5 Bottles) worth RM100.00",
                    "1 bottle 35ML worth RM79.00",
                    "1 T-Shirt",
                    "1 Simcard S4S",
                    "1 Prepaid card Mastercard from Mi-Pay",
                    "1 Lucky Draw Ticket"
                ],
                price: '25000',
                code: 'VIP2',
                categoryCode: 'xs88o64q',
                emailContent: 'Thank you for purchasing HUB GIFT PACK (WOMEN), we wish you a pleasant journey in using RewardsHub to spend & earn',
                packageCharge: 0
            },
            {
                type: 'VIP',
                picture: encodeImageToBase64('../vip3.jpg'),
                name: 'HUB GIFT PACK (MEN) 2',
                description: [
                    "2 Bottles of perfume worth RM79.00 each",
                    "1 bottle 10ML worth RM19.90",
                    "1 T-Shirt",
                    "1 Simcard S4S",
                    "1 Prepaid card Mastercard from Mi-Pay",
                    "1 Lucky Draw Ticket"
                ],
                price: '25000',
                code: 'VIP3',
                categoryCode: '2a4jkpbj',
                emailContent: 'Thank you for purchasing HUB GIFT PACK (MEN) 2, we wish you a pleasant journey in using RewardsHub to spend & earn',
                packageCharge: 0
            },
            {
                type: 'VIP',
                picture: encodeImageToBase64('../vip4.jpg'),
                name: 'HUB GIFT PACK (WOMEN) 2',
                description: [
                    "2 Bottles of perfume worth RM79.00 each",
                    "1 bottle 10ML worth RM19.90",
                    "1 T-Shirt",
                    "1 Simcard S4S",
                    "1 Prepaid card Mastercard from Mi-Pay",
                    "1 Lucky Draw Ticket"
                ],
                price: '25000',
                code: 'VIP4',
                categoryCode: 'l5o659nv',
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

preloadPackage();