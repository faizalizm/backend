const cors = require('cors');
const morgan = require('morgan');
const express = require('express');
const dotenv = require('dotenv').config();
const colors = require('colors');

const { errorHandler } = require('./middleware/errorMiddleware');
const connectDB = require('./services/mongodb');
const tourRouter = require('./routes/tourRoutes');

const swaggerUI = require('swagger-ui-express');
const swaggerSpec = require('./swagger/swagger');

const port = process.env.PORT || 3001;

// ------ Database Connection
connectDB();

// ------ Middleware
const app = express();
app.use(cors());
app.use(morgan('dev')); // Logger for requests
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
    next();
});

// ------ Routes
// app.get('/api/v1/tours', getAllTours);
// app.get('/api/v1/tours/:id', getTour);
// app.post('/api/v1/tours', createTour);
// app.patch('/api/v1/tours/:id', updateTour);
// app.delete('/api/v1/tours/:id', deleteTour);

//app.use('/', swaggerUI.serve, swaggerUI.setup(swaggerSpec));
//app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/member', require('./routes/memberRoutes'));

app.use(errorHandler);

// if (process.env.NODE_ENV === 'DEVELOPMENT') {
//   // ------ Server Startup
app.listen(port, () => {
    console.log(`App running on port ${port}`);
});
// } else if (process.env.NODE_ENV === 'PRODUCTION') {
//module.exports = app;
// } else {
//   console.log('ERROR : Environment not specified !');
// }
