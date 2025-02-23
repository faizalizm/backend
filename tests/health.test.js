const request = require('supertest');
const server = require('./testServer'); // Use the test-specific server
const mongoose = require('mongoose');

describe('GET /api/v1/health', () => {
    afterAll(async () => {
        await mongoose.connection.close(); // Ensure DB connection is closed
        server.close(); // Close the test server
    });

    it('should return health data with status 200', async () => {
        const res = await request(server).get('/api/v1/health').expect(200);

        expect(res.body).toHaveProperty('uptime');
//        expect(typeof res.body.uptime).toBe('number');
    });
});
