const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv').config({path: path.join(__dirname, '..', '..', '.env')});
const colors = require('colors');

const {connectDB} = require('../../services/mongodb');
const Advert = require('../../models/advertModel');

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

const preloadAdvert = async () => {
    console.log('🚀 Starting advert preload process...'.blue);
    try {
        const adverts = [
            {
                title: 'HubCafe',
                link: 'https://www.rewardhub.info',
                picture: encodeImageToBase64('../advert/advert-0.jpg'),
                priority: '0',
                status: 'Active',
                startDate: null,
                endDate: null
            },
            {
                title: 'Family Beauty Saloon',
                link: 'https://www.rewardhub.info',
                picture: encodeImageToBase64('../advert/advert-1.jpg'),
                priority: '1',
                status: 'Active',
                startDate: null,
                endDate: null
            },
            {
                title: 'KB Delight Cafe',
                link: 'https://www.rewardhub.info',
                picture: encodeImageToBase64('../advert/advert-2.jpg'),
                priority: '2',
                status: 'Active',
                startDate: null,
                endDate: null
            },
            {
                title: 'HA Hijrah Car Rental',
                link: 'https://www.rewardhub.info',
                picture: encodeImageToBase64('../advert/advert-3.jpg'),
                priority: '3',
                status: 'Active',
                startDate: null,
                endDate: null
            },
            {
                title: 'RewardHub',
                link: 'https://www.rewardhub.info',
                picture: encodeImageToBase64('../advert/advert-4.jpg'),
                priority: '4',
                status: 'Active',
                startDate: null,
                endDate: null
            },
            {
                title: 'RewardHub Ad Space',
                link: 'https://www.rewardhub.info',
                picture: encodeImageToBase64('../advert/advert-5.jpg'),
                priority: '5',
                status: 'Active',
                startDate: null,
                endDate: null
            }
        ];

        // Loop through adverts and add them to the database if they don't already exist
        for (const advert of adverts) {
            const existingAdvert = await Advert.findOne({name: advert.title});
            if (!existingAdvert) {
                const createdAdvert = await Advert.create(advert);
                console.log(`✅ Successfully created package: ${createdAdvert.title}`);
            } else {
                console.log(`⚠️ Package already exists: ${existingAdvert.title}`);
            }
        }
    } catch (error) {
        console.error('❌ Error preloading advert:', error.message);
    } finally {
        process.exit(); // Exit the script when done
    }
};

preloadAdvert();
