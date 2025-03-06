const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const errorHandler = require('./middleware/errorHandler');
const userRoutes=require('./routes/userRoute')
const menuRoutes = require("./routes/menuRoutes");
// Initialize the app
const app = express();

// Load environment variables
dotenv.config();

// Middleware
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies
app.use(cors()); // Enable Cross-Origin Resource Sharing

// Routes
app.use('/api/auth', authRoutes); // Authentication routes (register, login, profile)
app.use('/api/tickets', ticketRoutes); // Ticket management routes (create, validate, recharge, etc.)
app.use('/api/users', userRoutes); // user management routes 
app.use("/api/menus", menuRoutes);

// Error handling middleware
app.use(errorHandler); // Catch errors and send a structured response

module.exports = app;
