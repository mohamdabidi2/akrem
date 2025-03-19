const mongoose = require("mongoose");

const DishSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Nom du plat
  imageUrl: { type: String, required: true } // URL de l'image du plat
});

const MenuSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // Date du menu
  dishes: [DishSchema] // Liste des plats sous forme d'objets
});

module.exports = mongoose.model("Menu", MenuSchema);
