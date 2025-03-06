const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// Obtenir tous les utilisateurs
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Exclure le mot de passe
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
};

// Obtenir un utilisateur par CIN
exports.getUserByCin = async (req, res) => {
    try {
        const user = await User.findOne({ cin: req.params.cin }).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
};

// Mettre à jour un utilisateur
exports.updateUser = async (req, res) => {
    try {
        const { username, role } = req.body;
        const updatedUser = await User.findOneAndUpdate(
            { cin: req.params.cin },
            { username, role, updatedAt: Date.now() },
            { new: true }
        );
        if (!updatedUser) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        res.status(200).json({ message: 'Utilisateur mis à jour', user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
};

// Supprimer un utilisateur
exports.deleteUser = async (req, res) => {
    try {
        const deletedUser = await User.findOneAndDelete({ cin: req.params.cin });
        if (!deletedUser) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        res.status(200).json({ message: 'Utilisateur supprimé avec succès' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
};