const http = require('http');
const mongoose = require('mongoose');
const app = require('./src/app'); // Import the app configuration
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust for production
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle real-time notifications
  socket.on("sendNotification", (data) => {
    io.emit("newNotification", data); // Broadcast to all clients
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start the server
const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
