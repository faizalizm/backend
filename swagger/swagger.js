const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Mini Blog API',
    description: 'API endpoints for a mini blog services documented on swagger',
    contact: {
      name: 'faizalizm',
      email: 'faizalismail@contact.com',
      url: 'https://faizalismail.com',
    },
    version: '1.0.0',
  },
  servers: [
    {
      url: 'https://backend-cyan-nine.vercel.app/api/v1',
      description: 'v1 - Production server',
    },
  ],

  components: {
    schemas: {
      Tour: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Tour ID',
          },
          name: {
            type: 'string',
            description: 'Tour name',
          },
          duration: {
            type: 'number',
            description: 'Duration of the tour in days',
          },
          price: {
            type: 'number',
            description: 'Price of the tour',
          },
        },
      },
      TourInput: {
        type: 'object',
        required: ['name', 'duration', 'price'],
        properties: {
          name: {
            type: 'string',
            description: 'Tour name',
          },
          duration: {
            type: 'number',
            description: 'Duration of the tour in days',
          },
          price: {
            type: 'number',
            description: 'Price of the tour',
          },
        },
      },
    },
  },
};

const options = {
  swaggerDefinition,
  apis: ['./swagger/*Docs.js'], // Path to the API docs
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
