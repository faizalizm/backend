const path = require('path');
const dotenv = require('dotenv').config({path: path.join(__dirname, '..', '..', '.env')});
const colors = require('colors');

const {connectDB} = require('../../services/mongodb');
const Member = require('../../models/memberModel');
const Wallet = require('../../models/walletModel');
const Package = require('../../models/packageModel');
const Transaction = require('../../models/transactionModel');

const {preloadPackage} = require('./devPackagePreload');

// Connect to the database
connectDB();

const resetDatabase = async () => {
    console.log('🚀 Starting database reset process...'.blue);

    try {
        // ------ Clear collections
        console.log('🔄 Clearing collections...'.yellow);

        await Member.deleteMany();
        console.log('✅ Cleared Member collection.'.green);

        await Wallet.deleteMany();
        console.log('✅ Cleared Wallet collection.'.green);

        await Package.deleteMany();
        console.log('✅ Cleared Package collection.'.green);

        await Transaction.deleteMany();
        console.log('✅ Cleared Transaction collection.'.green);

        console.log('🎉 Database reset complete.'.cyan);

    } catch (error) {
        console.error('❌ Error during database reset:', error.message.red);
    } finally {
        process.exit(); // Ensure script exits when done
    }
};

resetDatabase().then(() => {
    preloadPackage();
});