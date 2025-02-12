// src/controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { username, cin, password, role } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ cin });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = await User.create({
      username,
      cin,
      password: hashedPassword,
      role, // "student" or "restaurateur"
    });

    if (user) {
      res.status(201).json({
        _id: user.id,
        username: user.username,
        cin: user.cin,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { cin, password } = req.body;

    const user = await User.findOne({ cin });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user.id,
        username: user.username,
        cin: user.cin,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

const getProfile = async (req, res) => {
    try {
        // The user ID is extracted from the JWT token by the authMiddleware
        const userId = req.user.id;

        // Find the user by their ID in the database
        const user = await User.findById(userId).select('-password'); // Exclude password field from the response

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Send user profile data as response
        res.status(200).json({
            id: user._id,
            name: user.name,
            email: user.email,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};
module.exports = { registerUser, loginUser ,getProfile};
