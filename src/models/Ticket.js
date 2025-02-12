const mongoose = require('mongoose');

// Ticket Schema definition
const ticketSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // Reference to the User model
            required: true,
        },
    
        status: {
            type: String,
            enum: ['available', 'used', 'expired'], // Possible ticket statuses
            default: 'available', // Default status when the ticket is created
        },
        barcode: {
            type: String,
            unique: true, // Ensures that each ticket has a unique barcode
            required: true,
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

// Pre-save hook to update `updatedAt`
ticketSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Create the Ticket model
const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
