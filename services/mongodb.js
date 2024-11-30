const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI.replace('<PASSWORD>', process.env.MONGO_PWD);
        const conn = await mongoose.connect(mongoURI);
        console.log(`MongoDB Connected : ${conn.connection.host}`.cyan.underline);

        mongoose.set('debug', true);

        if (process.env.NODE_ENV === 'DEV') {
            // Log all queries and their results
            mongoose.Query.prototype._exec = mongoose.Query.prototype.exec;

            mongoose.Query.prototype.exec = async function (...args) {
//                console.log('Executing Query:', this.getQuery());
//                console.log('Query Options:', this.options);

                // Execute the query and get the result
                const result = await this._exec(...args);

                // Log the result after the query completes
                console.log('Query Result:', result);

                return result; // Return the result to continue the execution flow
            };
        }
    } catch (error) {
        console.log(error)
        process.exit(1);
    }
}

module.exports = connectDB;