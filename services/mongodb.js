const colors = require('colors');
const mongoose = require('mongoose');

const {logger, trimBase64} = require('./logger');

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI.replace('<PASSWORD>', process.env.MONGO_PWD);
        const conn = await mongoose.connect(mongoURI);
        console.log(`MongoDB Connected : ${conn.connection.host}`.cyan.underline);

        mongoose.set('debug', (coll, method, query, doc) => {
            logger.info(`${colors.cyan('Mongoose:')} ${coll}.${method}(${JSON.stringify(query)}, ${JSON.stringify(doc)})`);
        });

        // Log all queries and their results
        mongoose.Query.prototype._exec = mongoose.Query.prototype.exec;

        mongoose.Query.prototype.exec = async function (...args) {
//                console.log('Executing Query:', this.getQuery());
//                console.log('Query Options:', this.options);

            // Execute the query and get the result
            const result = await this._exec(...args);

            // Log the result after the query completes
//                console.log('Query Result:', result);

            // Log the result after the query completes
            try {
                // Deep clone using JSON stringify/parse for safety
                const clonedResult = JSON.parse(JSON.stringify(result));
                const sanitizedResult = trimBase64(clonedResult);

                logger.info(`${colors.cyan('Mongoose:')} Query Result: ${JSON.stringify(sanitizedResult, null, 2)}`);
            } catch (error) {
                logger.error(`${colors.red('Error:')} Could not clone query result - ${error.message}`);
            }


//            logger.info(`${colors.cyan('Mongoose:')} Query Result: ${JSON.stringify(result, null, 2)}`);


            return result; // Return the result to continue the execution flow
        };

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
};

const closeDB = async () => {
    try {
        await mongoose.connection.close();
        logger.info('🔌 Database connection closed.');
    } catch (error) {
        logger.error('❌ Error closing the database:', error.message);
    }
};


module.exports = {connectDB, closeDB};