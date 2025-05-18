const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Schema definition
const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
        
        },
           uid: {
            type: String,
            required: true,
        
        },
        cin: {
            type: String,
            required: true,
            unique: true, 
            lowercase: true,
           
        },
        password: {
            type: String,
            required: true,
            minlength: 6, // Minimum length for the password
        },
        role: {
            type: String,
            enum: ['student', 'restaurateur','professeur'], // Different user roles
            default: 'student', // Default role
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt
    }
);



// Create the User model
const User = mongoose.model('User', userSchema);

module.exports = User;
