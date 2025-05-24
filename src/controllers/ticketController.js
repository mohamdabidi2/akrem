// Corrected ticketController.js (v6 - No Socket.IO)
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const Ticket = require("../models/Ticket"); // Assuming this path is correct relative to where this controller is used
const User = require("../models/User"); // Assuming this path is correct relative to where this controller is used
const debug = require("debug")("app:ticket");
const sharp = require("sharp");

// Canvas import (still needed for ZBar WASM)
const { createCanvas, loadImage } = require("canvas"); // Requires "canvas" package installation

// ZBar WASM import
const { scanImageData } = require("@undecaf/zbar-wasm"); // Requires "@undecaf/zbar-wasm" package installation

// Create a new ticket
exports.createTicket = async (req, res) => {
    try {
        const { userId, amount } = req.body;

        // Validate input
        if (!userId || !amount) {
            return res.status(400).json({ message: "User ID and amount are required" });
        }

        // Convert amount to number and validate
        const numAmount = parseInt(amount, 10);
        if (isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ message: "Amount must be a positive number" });
        }


        // Compter le nombre actuel de tickets de l"utilisateur
        const userTicketCount = await Ticket.countDocuments({ userId });

        // Vérifier si l"utilisateur dépasse la limite de 10 tickets
        if (userTicketCount + numAmount > 10) {
            return res.status(400).json({ message: "Maximum 10 tickets allowed per user" });
        }

        function generateBarcode(length = 12) {
            let barcode = "";
            for (let i = 0; i < length; i++) {
                barcode += Math.floor(Math.random() * 10); // Generate random digit (0-9)
            }
            // Ensure uniqueness (simple check, might need more robust solution for production)
            // This is just an example, real barcode generation might need specific formats/checksums
            return barcode;
        }

        const createdTickets = [];
        // Création des tickets
        for (let i = 0; i < numAmount; i++) {
            let uniqueBarcode;
            let attempts = 0;
            // Basic attempt to generate a unique barcode
            do {
                uniqueBarcode = generateBarcode();
                attempts++;
                if (attempts > 10) throw new Error("Failed to generate unique barcode"); // Prevent infinite loop
            } while (await Ticket.findOne({ barcode: uniqueBarcode }));

            const ticket = new Ticket({
                userId,
                barcode: uniqueBarcode,
                status: "available", // Ticket starts as available
                createdAt: new Date(),
            });

            await ticket.save();
            createdTickets.push(ticket); // Optional: collect created tickets if needed later
        }

        // Socket.IO notification removed

        res.status(201).json({ message: "Tickets created successfully", count: numAmount });
    } catch (err) {
        console.error("Error creating tickets:", err);
        res.status(500).json({ message: "Server error while creating tickets" });
    }
};


// Get all available tickets for a user
exports.getUserTickets = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
             return res.status(400).json({ message: "User ID is required in parameters" });
        }

        // Find tickets, optionally filter by status if needed (e.g., only "available")
        const tickets = await Ticket.find({ userId: userId /*, status: "available" */ }); // Find by userId

        res.status(200).json(tickets);
    } catch (err) {
        console.error("Error getting user tickets:", err);
        res.status(500).json({ message: "Server error while fetching tickets" });
    }
};

// Validate a ticket (for restaurateurs) - by barcode string
exports.validateTicket = async (req, res) => {
    try {
        const { barcode } = req.body; // Barcode string to validate the ticket

        if (!barcode) {
            return res.status(400).json({ message: "Barcode string is required" });
        }

        const ticket = await Ticket.findOne({ barcode });

        if (!ticket) {
            return res.status(404).json({ message: "Ticket not found for this barcode" });
        }

        if (ticket.status !== "available") {
            // Provide more specific message based on status
            const message = ticket.status === "used" ? "Ticket has already been used" : `Ticket is not available (status: ${ticket.status})`;
            return res.status(400).json({ message: message });
        }

        // Update ticket status to "used"
        ticket.status = "used";
        ticket.validatedAt = new Date(); // Add validation timestamp
        await ticket.save();

        // Socket.IO notification removed

        res.status(200).json({ message: "Ticket validated successfully", ticket });
    } catch (err) {
        console.error("Error validating ticket:", err);
        res.status(500).json({ message: "Server error during ticket validation" });
    }
};


// --- Barcode Image Verification ---

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Allow common image types
    if (!file.mimetype.match(/^image\/(jpeg|png|jpg|gif|bmp|webp)$/)) {
      debug("Invalid file type uploaded:", file.mimetype);
      return cb(new Error("Only image files (JPEG, PNG, GIF, BMP, WebP) are allowed"), false);
    }
    cb(null, true);
  }
});

// Helper to estimate image sharpness (Corrected v2)
async function estimateSharpness(imageBuffer) {
  try {
    // Get stats after converting to greyscale
    const stats = await sharp(imageBuffer)
      .greyscale()
      .stats();

    // Check if stats and channels are available and valid
    if (!stats || !stats.channels || !Array.isArray(stats.channels) || stats.channels.length === 0) {
        console.error("Sharpness estimation failed: Could not get channel stats.");
        return { error: "Could not get channel stats" };
    }

    // Access the first channel (should be the grey channel)
    const greyChannelStats = stats.channels[0];

    // Check if variance and mean are valid numbers
    if (typeof greyChannelStats.variance !== "number" || typeof greyChannelStats.mean !== "number") {
        console.error("Sharpness estimation failed: Invalid stats values.", greyChannelStats);
        return { error: "Invalid stats values" };
    }

    const variance = greyChannelStats.variance;
    const mean = greyChannelStats.mean;

    return {
      averageIntensity: mean,
      contrastVariance: variance,
      // Simple score, adjust based on testing
      sharpnessScore: variance / 1000
    };
  } catch (e) {
    console.error("Sharpness estimation failed unexpectedly:", e);
    // Provide more specific error if possible
    return { error: `Could not estimate sharpness: ${e.message}` };
  }
}


// Verify ticket via UID (replaces image-based verification)
exports.verifyTicket = async (req, res) => {
    const debugInfo = {
        receivedUid: null,
        decodedUserId: null,
        ticketStatus: null,
        error: null
    };

    try {
        const { uid } = req.body;

        // 1. Validate UID presence
        if (!uid) {
            debugInfo.error = "No UID received";
            return res.status(400).json({
                access: false,
                message: "User UID is required",
                debug: debugInfo
            });
        }
        debugInfo.receivedUid = uid;

        // 2. Find user by UID
        const user = await User.findOne({ uid });
        if (!user) {
            debugInfo.error = `No user found with UID: ${uid}`;
            return res.status(404).json({
                access: false,
                message: "User not found",
                debug: debugInfo
            });
        }

        // 3. Find and Validate an AVAILABLE Ticket for this User
        const ticket = await Ticket.findOne({ 
            userId: user._id.toString(), 
            status: "available" 
        });

        if (!ticket) {
            debugInfo.error = `No available ticket found for user UID: ${uid}`;
            debugInfo.ticketStatus = "No Available Ticket Found";
            return res.status(404).json({
                access: false,
                message: "No available ticket found for this user",
                debug: debugInfo
            });
        }

        debugInfo.ticketStatus = ticket.status; // Should be "available"

        // 4. Ticket is valid and available - Mark as used
        ticket.status = "used";
        ticket.validatedAt = new Date();
        await ticket.save();
        debugInfo.ticketStatus = "Used"; // Update status after saving

        // 5. Success Response
        return res.status(200).json({
            access: true,
            message: "Ticket validated successfully",
            ticket: {
                userId: ticket.userId,
                barcode: ticket.barcode,
                status: ticket.status,
                validatedAt: ticket.validatedAt
            },
            debug: debugInfo
        });

    } catch (err) {
        console.error("Unexpected error in verifyTicket:", err);
        debugInfo.error = `Internal Server Error: ${err.message}`;
        return res.status(500).json({
            access: false,
            message: "Internal server error during ticket verification",
            debug: debugInfo
        });
    }
};
// Add this to ticketController.js
exports.getTodayScannedTickets = async (req, res) => {
    try {
        // Get start of today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        // Get end of today
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Count tickets validated today
        const count = await Ticket.countDocuments({
            status: "used",
            validatedAt: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        });

        res.status(200).json({ count });
    } catch (err) {
        console.error("Error getting today's scanned tickets:", err);
        res.status(500).json({ message: "Server error while fetching today's tickets" });
    }
};