const Menu = require("../models/Menu");
const asyncHandler = require("express-async-handler");
const axios = require("axios");

// 📌 Récupérer tous les menus
exports.getMenus = asyncHandler(async (req, res) => {
  const menus = await Menu.find();
  res.json(menus);
});

// 📌 Ajouter un menu par date
exports.addMenu = asyncHandler(async (req, res) => {
  const { date } = req.body;

  const existingMenu = await Menu.findOne({ date });
  if (existingMenu) {
    return res.status(400).json({ error: "Le menu existe déjà" });
  }

  const newMenu = new Menu({ date, dishes: [] });
  await newMenu.save();
  res.status(201).json(newMenu);
});

// 📌 Configuration Filestack
const FILESTACK_API_KEY = "AZ9lQ0mkRSeiDveNGFDCaz";
const uploadImageToFilestack = async (imageBuffer, imageMimeType) => {
  try {
    const response = await axios.post(
      `https://www.filestackapi.com/api/store/S3?key=${FILESTACK_API_KEY}`,
      imageBuffer,
      {
        headers: {
          "Content-Type": imageMimeType,
        },
      }
    );
    return response.data.url;
  } catch (error) {
    throw new Error("Erreur lors de l'upload de l'image sur Filestack");
  }
};

// 📌 Ajouter un plat à une date spécifique avec upload d’image
exports.addDish = asyncHandler(async (req, res) => {
  const { date, dish } = req.body;
  const image = req.file;

  if (!date || !dish || !dish.name || !image) {
    return res.status(400).json({ error: "Date, plat et image requis" });
  }

  const menu = await Menu.findOne({ date });
  if (!menu) {
    return res.status(404).json({ error: "Menu introuvable" });
  }

  const dishExists = menu.dishes.some((d) => d.name === dish.name);
  if (dishExists) {
    return res.status(400).json({ error: "Ce plat est déjà dans le menu" });
  }

  const imageUrl = await uploadImageToFilestack(image.buffer, image.mimetype);

  menu.dishes.push({ name: dish.name, imageUrl });
  await menu.save();

  res.status(200).json({ message: "Plat ajouté avec succès", menu });
});

// 📌 Modifier un plat
exports.editDish = asyncHandler(async (req, res) => {
  const { date, oldDishName, newDish } = req.body;

  if (!date || !oldDishName || !newDish) {
    return res.status(400).json({ error: "Données incomplètes" });
  }

  const menu = await Menu.findOne({ date });
  if (!menu) {
    return res.status(404).json({ error: "Menu introuvable" });
  }

  const dishIndex = menu.dishes.findIndex((d) => d.name === oldDishName);
  if (dishIndex === -1) {
    return res.status(404).json({ error: "Plat introuvable" });
  }

  menu.dishes[dishIndex] = newDish;
  await menu.save();

  res.json({ message: "Plat modifié avec succès", menu });
});

// 📌 Supprimer un plat d'un menu
exports.deleteDish = asyncHandler(async (req, res) => {
  const { date, dishName } = req.body;

  if (!date || !dishName) {
    return res.status(400).json({ error: "Date et nom du plat requis" });
  }

  const menu = await Menu.findOne({ date });
  if (!menu) {
    return res.status(404).json({ error: "Menu introuvable" });
  }

  const updatedDishes = menu.dishes.filter((d) => d.name !== dishName);
  if (updatedDishes.length === menu.dishes.length) {
    return res.status(404).json({ error: "Plat non trouvé" });
  }

  menu.dishes = updatedDishes;
  await menu.save();

  res.json({ message: "Plat supprimé avec succès", menu });
});

// 📌 Supprimer un menu entier
exports.deleteMenu = asyncHandler(async (req, res) => {
  const { date } = req.params;

  const menu = await Menu.findOneAndDelete({ date });
  if (!menu) {
    return res.status(404).json({ error: "Menu introuvable" });
  }

  res.json({ message: "Menu supprimé" });
});

// 📌 Récupérer le menu du jour
exports.getTodayMenu = asyncHandler(async (req, res) => {
  const todayDate = new Date().toISOString().split("T")[0];

  const menu = await Menu.findOne({ date: todayDate });
  if (!menu) {
    return res.status(404).json({ error: "Menu du jour introuvable" });
  }

  res.json([menu]); // Format pour Flutter
});
