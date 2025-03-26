const express = require('express');
const ticketController = require('../controllers/ticketController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Middleware to pass `io` to controllers
const attachIo = (handler) => (req, res) => handler(req, res, req.io);

// Route to create a new ticket (protected route)
router.post('/create', authMiddleware, attachIo(ticketController.createTicket));

// Route to get all available tickets for a specific user (protected route)
router.get('/user/:userId', ticketController.getUserTickets);

// Route to validate a ticket (for restaurateurs) (protected route)
router.post('/validate', authMiddleware, attachIo(ticketController.validateTicket));
router.get('/verify/:userId', ticketController.verifyTicket);

module.exports = router;
