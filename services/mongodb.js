const colors = require('colors');
const mongoose = require('mongoose');

const {logger, trimBase64} = require('./logger');

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI.replace('<PASSWORD>', process.env.MONGO_PWD);
        const conn = await mongoose.connect(mongoURI);
        console.log(`MongoDB Connected : ${conn.connection.host}`.cyan.underline);

        mongoose.set('debug', (coll, method, query, doc) => {
            logger.info(colors.gray(`Mongoose: ${coll}.${method}(${JSON.stringify(query)}, ${JSON.stringify(doc)})`));
        });

        // Log all queries and their results
        mongoose.Query.prototype._exec = mongoose.Query.prototype.exec;

        mongoose.Query.prototype.exec = async function (...args) {
            const queryStartExecuteTime = Date.now();
//                console.log('Executing Query:', this.getQuery());
//                console.log('Query Options:', this.options);

            // Execute the query and get the result
            const result = await this._exec(...args);

            const queryExecutionTime = Date.now() - queryStartExecuteTime;

            let affectedCount = 0;
            if (Array.isArray(result)) {
                affectedCount = result.length; // For find() or insertMany()
            } else if (typeof result === 'object' && result !== null) {
                switch (this.op) {
                    case 'findOne':
                        affectedCount = result ? 1 : 0;  // ✅ For `findOne()`, returns a single object or null
                        break;
                    case 'countDocuments':
                    case 'estimatedDocumentCount':
                        affectedCount = result;  // ✅ For counting queries
                        break;
                    case 'updateOne':
                    case 'updateMany':
                        affectedCount = result.matchedCount || 0;  // ✅ For `updateOne()`, `updateMany()`
                        break;
                    case 'replaceOne':
                        affectedCount = result.modifiedCount || 0;  // ✅ For `replaceOne()`
                        break;
                    case 'deleteOne':
                    case 'deleteMany':
                        affectedCount = result.deletedCount || 0;  // ✅ For `deleteOne()`, `deleteMany()`
                        break;
                    case 'insertOne':
                        affectedCount = result.acknowledged ? 1 : 0;  // ✅ For `insertOne()`
                        break;
                    default:
                        affectedCount = result.matchedCount || result.modifiedCount || result.deletedCount || 0;
                }
            }

            // Log the result after the query completes
            logger.info(colors.gray(`Mongoose: ${this.mongooseCollection.name}.${this.op} | Query Duration ${queryExecutionTime} ms | Queried [${affectedCount}]`));

            // Log the result after the query completes * Includes full query result
//            try {
//                // Deep clone using JSON stringify/parse for safety
//                const clonedResult = JSON.parse(JSON.stringify(result));
//                const sanitizedResult = trimBase64(clonedResult);
//
//                logger.info(`${colors.cyan('Mongoose:')} ${queryExecutionTime}s - Query Result: ${JSON.stringify(sanitizedResult, null, 2)}`);
//            } catch (error) {
//                logger.error(`${colors.red('Error:')} Could not clone query result - ${error.message}`);
//            }

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