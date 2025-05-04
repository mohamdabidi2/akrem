// Corrected ticketController.js (v3 - using ZBar WASM)
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const Ticket = require("../models/Ticket"); // Assuming this path is correct relative to where this controller is used
const debug = require("debug")("app:ticket");
const sharp = require("sharp");

// Canvas import (still needed for ZBar WASM)
const { createCanvas, loadImage } = require("canvas"); // Requires "canvas" package installation

// ZBar WASM import
const { scanImageData } = require("@undecaf/zbar-wasm"); // Requires "@undecaf/zbar-wasm" package installation

// Create a new ticket
exports.createTicket = async (req, res, io) => {
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

        // Émettre une notification en temps réel à l"utilisateur
        if (io) { // Check if io object is provided
             io.emit("newNotification", {
                 userId,
                 message: `You have successfully recharged ${numAmount} ticket(s)! 🎉`,
                 timestamp: new Date(),
             });
        } else {
            debug("Socket.io object (io) not provided to createTicket");
        }


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

        // It"s okay if a user has no tickets, return empty array instead of 404
        // if (!tickets.length) {
        //     return res.status(404).json({ message: "No available tickets found for this user" });
        // }

        res.status(200).json(tickets);
    } catch (err) {
        console.error("Error getting user tickets:", err);
        res.status(500).json({ message: "Server error while fetching tickets" });
    }
};

// Validate a ticket (for restaurateurs) - by barcode string
exports.validateTicket = async (req, res, io) => {
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

        // Emit a real-time notification to the specific user
        if (io) { // Check if io object is provided
            // Consider emitting to a specific user room if applicable: io.to(ticket.userId).emit(...)
            io.emit("newNotification", { // Or emit to a specific user/room
                userId: ticket.userId,
                message: `Your ticket with barcode ${barcode} has been validated successfully! ✅`,
                timestamp: new Date(),
            });
         } else {
            debug("Socket.io object (io) not provided to validateTicket");
         }

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


// Verify ticket via barcode image upload (Using ZBar WASM)
exports.verifyTicket = [
  upload.single("barcodeImage"), // Middleware for handling single file upload named "barcodeImage"
  async (req, res, io) => {
    const debugInfo = { // Collect debug info throughout the process
        receivedFile: !!req.file,
        fileDetails: req.file ? { name: req.file.originalname, size: req.file.size, type: req.file.mimetype } : null,
        decodeAttempts: [],
        imageAnalysis: null,
        finalUserId: null,
        ticketStatus: null,
        error: null
    };

    try {
      // 1. Validate file presence
      if (!req.file?.buffer) {
        debugInfo.error = "No image buffer received";
        return res.status(400).json({
          access: false,
          message: "Valid barcode image is required",
          debug: debugInfo
        });
      }
      debugInfo.imageAnalysis = { originalSize: req.file.size };


      // 2. Image preprocessing with Sharp
      let processedImageBuffer;
      try {
        processedImageBuffer = await sharp(req.file.buffer)
          // .resize(800) // Optional: Resize for consistency, might affect small barcodes
          .ensureAlpha() // Ensure alpha channel exists before flattening
          .flatten({ background: { r: 255, g: 255, b: 255 } }) // Flatten transparency with white background
          .normalise() // Enhance contrast
          // .sharpen() // Optional: Sharpening might help or hinder
          .linear(1.1) // Adjust brightness/contrast
          .toBuffer();
        debugInfo.imageAnalysis.processedSize = processedImageBuffer.length;
      } catch (processError) {
         debugInfo.error = `Image processing failed: ${processError.message}`;
         console.error("Image processing error:", processError);
         return res.status(400).json({
           access: false,
           message: "Image processing failed",
           debug: debugInfo
         });
      }

      // 3. Multiple decoding attempts
      let userId = null; // Will store the decoded barcode text (assuming it"s the userId)
      let decodedSymbols = []; // Store results from ZBar

      // Attempt 1: Local ZBar Decoder using @undecaf/zbar-wasm
      try {
        // Load image buffer with node-canvas
        const image = await loadImage(processedImageBuffer);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, image.width, image.height);
        // Get ImageData from the canvas
        const imageData = ctx.getImageData(0, 0, image.width, image.height);

        // Scan image data using ZBar WASM
        // This returns an array of detected symbols
        decodedSymbols = await scanImageData(imageData);

        if (decodedSymbols.length > 0) {
            // Assuming the first detected barcode is the one we want
            // The actual data is in rawData after decoding
            const firstSymbol = decodedSymbols[0];
            userId = firstSymbol.decode("utf-8"); // Decode raw data as UTF-8 string
            debugInfo.finalUserId = userId;
            debugInfo.decodeAttempts.push({
                method: "Local ZBar WASM",
                success: true,
                result: userId,
                details: decodedSymbols.map(s => ({ type: s.typeName, data: s.decode("utf-8") }))
            });
        } else {
            // No barcode found by ZBar
            debugInfo.decodeAttempts.push({
                method: "Local ZBar WASM",
                success: false,
                error: "No barcode detected by ZBar WASM"
            });
            console.log("Local ZBar WASM: No barcode detected");
        }

      } catch (zbarError) {
        // Log unexpected errors during ZBar processing
        console.error("Local ZBar WASM Decode Error:", zbarError);
        debugInfo.decodeAttempts.push({
          method: "Local ZBar WASM",
          success: false,
          error: zbarError.message
        });
      }

      // Attempt 2: ZXing Web API (Fallback if ZBar failed)
      if (!userId) {
          try {
            const formData = new FormData();
            formData.append("file", processedImageBuffer, {
              filename: "barcode.png", // Filename is required by some APIs
              contentType: "image/png" // Set content type explicitly
            });

            const zxingResponse = await axios.post("https://zxing.org/w/decode", formData, {
              headers: formData.getHeaders(),
              timeout: 7000 // Increased timeout
            });

            const responseText = zxingResponse.data;
            let parsedText = null;

            // Enhanced parsing for HTML response (patterns might need adjustment if zxing.org changes)
            const patterns = [
              /"rawText"\s*:\s*"([^"]+)"/,       // JSON rawText
              /Parsed Result(?:<\/strong>)?\s*<pre>([^<]+)<\/pre>/, // HTML Parsed Result <pre>
              /Raw text(?:<\/strong>)?\s*<pre>([^<]+)<\/pre>/,      // HTML Raw text <pre>
              /Parsed Text:\s*<code>([^<]+)<\/code>/, // Older HTML format?
              /Text:\s*<code>([^<]+)<\/code>/          // Another possible HTML format
            ];

            for (const pattern of patterns) {
              const match = responseText.match(pattern);
              if (match && match[1]) {
                parsedText = match[1].trim();
                break;
              }
            }

            debugInfo.decodeAttempts.push({
              method: "ZXing Web API",
              success: !!parsedText,
              result: parsedText,
              // responseSample: responseText.substring(0, 300) // Log more for debugging if needed
            });

            if (parsedText) {
                userId = parsedText;
                debugInfo.finalUserId = userId;
            }
          } catch (zxingError) {
            debugInfo.decodeAttempts.push({
              method: "ZXing Web API",
              success: false,
              error: zxingError.response ? `Status ${zxingError.response.status}` : zxingError.message
            });
             console.error("ZXing Web API Error:", zxingError.message);
          }
      }

      // 4. Analyze Image if decoding failed after all attempts
      if (!userId) {
        try {
          const metadata = await sharp(processedImageBuffer).metadata();
          // Call corrected helper function
          const sharpnessInfo = await estimateSharpness(processedImageBuffer);

          debugInfo.imageAnalysis = {
            ...debugInfo.imageAnalysis, // Keep original/processed size
            dimensions: { width: metadata.width, height: metadata.height },
            format: metadata.format,
            hasAlpha: metadata.hasAlpha,
            isGrayscale: metadata.space === "b-w", // Check color space
            sharpness: sharpnessInfo // Include sharpness results
          };
        } catch (analysisError) {
          console.error("Image analysis error:", analysisError);
          if (debugInfo.imageAnalysis) {
             debugInfo.imageAnalysis.error = analysisError.message;
          } else {
             debugInfo.imageAnalysis = { error: analysisError.message };
          }
        }

        debugInfo.error = "No valid barcode detected after all attempts (ZBar & ZXing Web API)";
        return res.status(400).json({
          access: false,
          message: "No valid barcode detected in the image",
          debug: debugInfo
        });
      }

      // 5. Barcode Found - Now Validate the Ticket using the decoded barcode (userId)
      const ticket = await Ticket.findOne({ barcode: userId }); // Assuming decoded text is the barcode

      if (!ticket) {
          debugInfo.error = `Ticket not found for decoded barcode: ${userId}`;
          debugInfo.ticketStatus = "Not Found";
          return res.status(404).json({
              access: false,
              message: "Decoded barcode does not correspond to a valid ticket",
              debug: debugInfo
          });
      }

      debugInfo.ticketStatus = ticket.status;

      if (ticket.status !== "available") {
          const message = ticket.status === "used" ? "Ticket has already been used" : `Ticket is not available (status: ${ticket.status})`;
          debugInfo.error = message;
          return res.status(400).json({
              access: false,
              message: message,
              debug: debugInfo
          });
      }

      // 6. Ticket is valid and available - Mark as used
      ticket.status = "used";
      ticket.validatedAt = new Date();
      await ticket.save();
      debugInfo.ticketStatus = "Used"; // Update status after saving

      // Emit real-time notification
      if (io) {
          io.emit("newNotification", { // Or emit to specific user/room
              userId: ticket.userId, // Notify the original owner
              message: `Your ticket (Barcode: ${userId}) has been validated successfully via image upload! ✅`,
              timestamp: new Date(),
          });
      } else {
           debug("Socket.io object (io) not provided to verifyTicket");
      }

      // 7. Success Response
      return res.status(200).json({
          access: true,
          message: "Ticket validated successfully via image upload",
          ticket: { // Return relevant ticket info
              userId: ticket.userId,
              barcode: ticket.barcode,
              status: ticket.status,
              validatedAt: ticket.validatedAt
          },
          debug: debugInfo // Include debug info even on success if helpful
      });

    } catch (err) {
      // Catch all unexpected errors
      console.error("Unexpected error in verifyTicket:", err);
      debugInfo.error = `Internal Server Error: ${err.message}`;
      return res.status(500).json({
        access: false,
        message: "Internal server error during ticket verification",
        debug: debugInfo // Provide debug info for server errors too
      });
    }
  }
];

// Add a check for model path if possible, or ensure it"s correct in the project structure
try {
  // This is just a placeholder check; actual model loading happens in the functions
  if (typeof Ticket === "undefined") {
    console.warn("Ticket model might not be loaded correctly. Check path \"../models/Ticket\"");
  }
} catch (e) {
  console.error("Error checking Ticket model:", e);
}

