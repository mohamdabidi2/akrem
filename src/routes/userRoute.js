const express = require('express');
const router = express.Router();
const userController = require('../controllers/usersController');


// Routes protégées (ajouter une authentification middleware si nécessaire)
router.get('/', userController.getUsers);
router.get('/:cin', userController.getUserByCin);
router.put('/:cin', userController.updateUser);
router.delete('/:cin', userController.deleteUser);

module.exports = router;
