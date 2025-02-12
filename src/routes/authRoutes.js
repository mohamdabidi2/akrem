const express = require('express');
const authController = require('../controllers/authController');  // Import the controller
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Route to register a new user
router.post('/register', authController.registerUser);  // This should point to the correct function in authController.js

// Route to log in an existing user
router.post('/login', authController.loginUser);

// Route to get the logged-in user's profile (protected route)
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;
