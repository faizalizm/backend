/**
 * @openapi
 * /tours/:
 *   get:
 *     tags:
 *       - Tours
 *     summary: Get all tours
 *     responses:
 *       200:
 *         description: Successfully retrieved all tours
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: SUCCESS
 *                 requestTime:
 *                   type: string
 *                   example: 2024-11-20T12:00:00Z
 *                 results:
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: object
 *                   properties:
 *                     tours:
 *                       type: array
 *                       items:
 *                         type: object
 */

/**
 * @openapi
 * /tours/:
 *   post:
 *     tags:
 *       - Tours
 *     summary: Create a new tour
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "New Tour"
 *               duration:
 *                 type: integer
 *                 example: 7
 *               price:
 *                 type: number
 *                 example: 499.99
 *     responses:
 *       201:
 *         description: Successfully created a new tour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: SUCCESS
 *                 data:
 *                   type: object
 *                   properties:
 *                     tour:
 *                       type: array
 *                       items:
 *                         type: object
 */

/**
 * @openapi
 * /tours/{id}:
 *   get:
 *     tags:
 *       - Tours
 *     summary: Get a specific tour by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the tour to retrieve
 *     responses:
 *       200:
 *         description: Successfully retrieved the tour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: SUCCESS
 *                 data:
 *                   type: object
 *                   properties:
 *                     tour:
 *                       type: object
 *       404:
 *         description: Tour not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: Invalid ID
 */

/**
 * @openapi
 * /tours/{id}:
 *   patch:
 *     tags:
 *       - Tours
 *     summary: Update a specific tour by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the tour to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Tour Name"
 *               duration:
 *                 type: integer
 *                 example: 10
 *               price:
 *                 type: number
 *                 example: 599.99
 *     responses:
 *       200:
 *         description: Successfully updated the tour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: SUCCESS
 *                 data:
 *                   type: object
 *                   properties:
 *                     tour:
 *                       type: string
 *                       example: "<Updated Tour>"
 *       404:
 *         description: Tour not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: Invalid ID
 */

/**
 * @openapi
 * /tours/{id}:
 *   delete:
 *     tags:
 *       - Tours
 *     summary: Delete a specific tour by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the tour to delete
 *     responses:
 *       204:
 *         description: Successfully deleted the tour
 *       404:
 *         description: Tour not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: Invalid ID
 */
