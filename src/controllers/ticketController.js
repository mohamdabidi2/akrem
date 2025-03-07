const Ticket = require('../models/Ticket');

// Create a new ticket
exports.createTicket = async (req, res, io) => {
    try {
        const { userId, amount } = req.body;

        // Validate input
        if (!userId || !amount) {
            return res.status(400).json({ message: 'User ID and amount are required' });
        }

        for (let i = 0; i < amount; i++) {
            function generateBarcode(length = 12) {
                let barcode = "";
                for (let i = 0; i < length; i++) {
                    barcode += Math.floor(Math.random() * 10); // Generate random digit (0-9)
                }
                return barcode;
            }

            const ticket = new Ticket({
                userId,
                barcode: generateBarcode(),
                status: 'available', // Ticket starts as available
                createdAt: new Date(),
            });

            await ticket.save();
        }

        // Emit a real-time notification to the specific user
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
