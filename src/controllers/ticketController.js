const Ticket = require('../models/Ticket');

// Create a new ticket
exports.createTicket = async (req, res, io) => {
    try {
        const { userId, amount } = req.body;

        // Validate input
        if (!userId || !amount) {
            return res.status(400).json({ message: 'User ID and amount are required' });
        }

        // Compter le nombre actuel de tickets de l'utilisateur
        const userTicketCount = await Ticket.countDocuments({ userId });

        // Vérifier si l'utilisateur dépasse la limite de 10 tickets
        if (userTicketCount + amount > 10) {
            return res.status(400).json({ message: 'Maximum 10 tickets allowed per user' });
        }

        function generateBarcode(length = 12) {
            let barcode = "";
            for (let i = 0; i < length; i++) {
                barcode += Math.floor(Math.random() * 10); // Generate random digit (0-9)
            }
            return barcode;
        }

        // Création des tickets
        for (let i = 0; i < amount; i++) {
            const ticket = new Ticket({
                userId,
                barcode: generateBarcode(),
                status: 'available', // Ticket starts as available
                createdAt: new Date(),
            });

            await ticket.save();
        }

        // Émettre une notification en temps réel à l'utilisateur
        io.emit("newNotification", {
            userId,
            message: `You have successfully recharged ${amount} ticket(s)! 🎉`,
            timestamp: new Date(),
        });

        res.status(201).json({ message: 'Tickets created successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};


// Get all available tickets for a user
exports.getUserTickets = async (req, res) => {
    try {
        const { userId } = req.params;

        const tickets = await Ticket.find({ userId});

        if (!tickets.length) {
            return res.status(404).json({ message: 'No available tickets found' });
        }

        res.status(200).json(tickets);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Validate a ticket (for restaurateurs)
exports.validateTicket = async (req, res, io) => {
    try {
        const { barcode } = req.body; // Barcode to validate the ticket

        if (!barcode) {
            return res.status(400).json({ message: 'Barcode is required' });
        }

        const ticket = await Ticket.findOne({ barcode });

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        if (ticket.status !== 'available') {
            return res.status(400).json({ message: 'Ticket has already been used or is invalid' });
        }

        // Update ticket status to "used"
        ticket.status = 'used';
        await ticket.save();

        // Emit a real-time notification
        io.emit("newNotification", {
            userId: ticket.userId,
            message: `Your ticket with barcode ${barcode} has been validated successfully! ✅`,
            timestamp: new Date(),
        });

        res.status(200).json({ message: 'Ticket validated successfully', ticket });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.verifyTicket = async (req, res, io) => {
    console.log("working")
    try {
        const { userId } = req.params;

        // Validate user ID
        if (!userId) {
            return res.status(400).json({
                access: false,
                message: "User ID is required"
            });
        }

        // Find the oldest available ticket (FIFO approach)
        const ticket = await Ticket.findOne({
            userId,
            status: 'available'
        }).sort({ createdAt: 1 }); // Get oldest ticket first

        if (!ticket) {
            return res.status(404).json({
                access: false,
                message: "No available tickets found for this user"
            });
        }

        // Check for ticket expiration (24-hour validity)
        const now = new Date();
        const ticketAgeHours = (now - ticket.createdAt) / (1000 * 60 * 60);

        if (ticketAgeHours > 24) {
            ticket.status = 'expired';
            await ticket.save();

            io.emit("newNotification", {
                userId,
                message: `Ticket ${ticket.barcode} expired without use`,
                timestamp: now
            });

            return res.status(400).json({
                access: false,
                message: "Ticket has expired"
            });
        }

        // Mark ticket as used
        ticket.status = 'used';
        ticket.updatedAt = now;
        await ticket.save();

        // Send real-time notification
        io.emit("newNotification", {
            userId,
            message: `Ticket ${ticket.barcode} used for access`,
            timestamp: now
        });

        return res.status(200).json({
            access: true,
            message: "Access granted",
            ticket: {
                barcode: ticket.barcode,
                createdAt: ticket.createdAt
            }
        });

    } catch (err) {
        console.error('Ticket verification error:', err);
        return res.status(500).json({
            access: false,
            message: "Internal server error during ticket verification"
        });
    }
};