const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Assuming you have a User model

// Middleware to check if the user is authenticated
const authMiddleware = async (req, res, next) => {
    try {
        // Get the token from the Authorization header
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'No token provided, authorization denied' });
        }

        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find the user by the ID in the decoded token
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        // Attach the user to the request object for further use
        req.user = user;
        next();
    } catch (err) {
        console.error(err);
        res.status(401).json({ message: 'Token is not valid' });
    }
};

module.exports = authMiddleware;
