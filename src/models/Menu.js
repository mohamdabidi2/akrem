const mongoose = require("mongoose");

const MenuSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // Date du menu
  dishes: [{ type: String, required: true }] // Liste des plats
});

module.exports = mongoose.model("Menu", MenuSchema);
