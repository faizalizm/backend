const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv').config({path: path.join(__dirname, '..', '..', '.env')});
const colors = require('colors');
const {connectDB} = require('../../services/mongodb');
const Charity = require('../../models/charityModel');

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

const preloadCharity = async () => {
    console.log('🚀 Starting charity preload process...'.blue);
    try {
        const charity = [
            {
                picture: encodeImageToBase64('../palestine.jpg'),
                name: 'Palestine: Give life-saving aid',
                description: 'The people of Gaza have been paying the heaviest cost of war, deprived of basic human rights. Beyond Gaza, thousands of Palestine Refugee families in the region are living in poverty, not knowing where their next meal will come from',
                category: [
                    "Conflict",
                    "Emergency"
                ],
                donationAmount: '25000',
                donationCount: '5',
                contributedAmount: '1000',
                goal: 3000000, // rm 30k
                status: 'Active'
            },
            {
                picture: encodeImageToBase64('../masjidnegerisabah.jpg'),
                name: 'Masjid Negeri Sabah (Support Education Programs)',
                description: 'Help empower the next generation by supporting educational initiatives aimed at providing better opportunities for underprivileged youth. Your contributions can make a lasting impact on their lives and our community.',
                category: [
                    "Education"
                ],
                donationAmount: '1000',
                donationCount: '1',
                contributedAmount: '100',
                goal: 1000000, // rm 10k
                status: 'Active'
            }
        ];
        // Loop through charity and add them to the database
        for (const charityData of charity) {
            const createdCharity = await Charity.create(charityData);
        }
    } catch (error) {
        console.error('❌ Error preloading charity:', error.message);
    } finally {
        process.exit(); // Exit the script when done
    }
};

preloadCharity();
