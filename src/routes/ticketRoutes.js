const express = require('express');
const ticketController = require('../controllers/ticketController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Route to create a new ticket (protected route)
router.post('/create', ticketController.createTicket);

// Route to get all available tickets for a specific user (protected route)
router.get('/user/:userId', ticketController.getUserTickets);

// Route to validate a ticket (for restaurateurs) (protected route)
router.post('/validate', ticketController.validateTicket);


module.exports = router;
