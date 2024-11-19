require('dotenv').config();

const cors = require('cors');
const morgan = require('morgan');
const express = require('express');
const swaggerUI = require('swagger-ui-express');
const swaggerSpec = require('./swagger/swagger');

const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');

const app = express();

// ------ Middleware
app.use(cors());
app.use(morgan('dev')); // Logger for requests
app.use(express.json());
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

// Serve Swagger documentation
app.use('/', swaggerUI.serve, swaggerUI.setup(swaggerSpec));
// app.get('/', (req, res) => res.send('Express on Vercel'));
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);

// ------ Server Startup
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`App running on port ${port}`);
});

module.exports = app;
