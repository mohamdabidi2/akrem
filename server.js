const mongoose = require('mongoose');
const app = require('./src/app'); // Import the app configuration
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');

// Connect to MongoDB
dotenv.config();
connectDB();
// Start the server
const port = process.env.PORT || 5000; // Default to port 5000 if not specified
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
