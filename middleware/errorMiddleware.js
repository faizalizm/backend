const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode ? res.statusCode : 500;

    res.status(statusCode);

    res.json({
        message: err.message,
        stack: err.stack
//        stack: process.env.VERCEL_ENV !== 'production' ? null : err.stack
    });
};

module.exports = {errorHandler};