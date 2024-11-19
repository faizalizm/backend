const express = require('express');
const morgan = require('morgan');

const firebaseApp = require('./firebase'); // Import the app instance directly
const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');

const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');

const app = express();

// ------ Middleware
app.use(morgan('dev')); // Logger for requests
app.use(express.json());
app.use((req, res, next) => {
  console.log('Hello from middleware 👋🏻');
  next();
});
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

app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);

// Firebase Setup
console.log('Firebase App Initialized:', firebaseApp);

// ------ Server Startup
const port = 3000;
app.listen(port, () => {
  console.log(`App running on port ${port}`);
});
