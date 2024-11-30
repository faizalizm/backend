const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI.replace('<PASSWORD>', process.env.MONGO_PWD);
        console.log(`MongoDB URI : ${mongoURI}`.cyan.underline);
        const conn = await mongoose.connect(mongoURI);
        console.log(`MongoDB Connected : ${conn.connection.host}`.cyan.underline);
    } catch (error) {
        console.log(error)
        process.exit(1);
    }
}

module.exports = connectDB;