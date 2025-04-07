const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv').config({path: path.join(__dirname, '..', '..', '.env')});
const colors = require('colors');

const {connectDB} = require('../../services/mongodb');
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
                type: 'VIP',
                picture: encodeImageToBase64('../vipPackage.webp'),
                name: 'VIP Package',
                description: [
                    "Sebagai Pengguna VIP Yang dapat Banyak ganjaran menarik.",
                    "50% Cashback dari merchant cashback rate",
                    "Layak terima 20 Tier Referral reward",
                    "Layak terima 20 Tier Spending Reward",
                    "1 keping Exclusive Lucky Draw",
                    "GIFT PACK VIP",
                    "Dapat personal web untuk marketing",
                    "Exlusive Member Card NFC Card",
                    "Social Media Template Pack",
                    "Dapat Ruangan Iklan PERCUMA selama sebulan di halaman utama"
                ],
                price: '25000',
                code: 'VIP0',
                categoryCode: 'yfs7mb5j',
                emailContent: 'Thank you for purchasing the VIP Package, we wish you a pleasant journey in using RewardsHub to spend & earn',
                packageCharge: 0
            },
            {
                type: 'VIP',
                picture: encodeImageToBase64('../merchantPackage.webp'),
                name: 'Merchant Package',
                description: [
                    "Sebagai Pengguna VIP Yang dapat Banyak ganjaran menarik.",
                    "50% Cashback dari merchant cashback rate",
                    "Layak terima 20 Tier Referral reward",
                    "Layak terima 20 Tier Spending Reward",
                    "1 keping Exclusive Lucky Draw",
                    "GIFT PACK MERCHANT",
                    "Dapat personal web untuk marketing",
                    "Exlusive Member Card NFC Card",
                    "Social Media Template Pack",
                    "Dapat Ruangan Iklan PERCUMA selama sebulan di halaman utama"
                ],
                price: '25000',
                code: 'MERCHANT0',
                categoryCode: 'lsr854x6',
                emailContent: 'Thank you for purchasing the Merchant Package, we wish you a pleasant journey in using RewardsHub to spend & earn',
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
