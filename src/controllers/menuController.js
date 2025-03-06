const Menu = require("../models/Menu");

// 📌 Récupérer tous les menus
exports.getMenus = async (req, res) => {
  try {
    const menus = await Menu.find();
    res.json(menus);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// 📌 Ajouter un menu par date
exports.addMenu = async (req, res) => {
  const { date } = req.body;
  try {
    const existingMenu = await Menu.findOne({ date });
    if (existingMenu) {
      return res.status(400).json({ error: "Le menu existe déjà" });
    }

    const newMenu = new Menu({ date, dishes: [] });
    await newMenu.save();
    res.status(201).json(newMenu);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// 📌 Ajouter un plat à une date spécifique
exports.addDish = async (req, res) => {
  const { date, dish } = req.body;
  try {
    const menu = await Menu.findOne({ date });
    if (!menu) {
      return res.status(404).json({ error: "Menu introuvable" });
    }

    menu.dishes.push(dish);
    await menu.save();
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// 📌 Modifier un plat
exports.editDish = async (req, res) => {
  const { date, oldDish, newDish } = req.body;
  try {
    const menu = await Menu.findOne({ date });
    if (!menu) {
      return res.status(404).json({ error: "Menu introuvable" });
    }

    const dishIndex = menu.dishes.indexOf(oldDish);
    if (dishIndex === -1) {
      return res.status(404).json({ error: "Plat introuvable" });
    }

    menu.dishes[dishIndex] = newDish;
    await menu.save();
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// 📌 Supprimer un plat d'un menu
exports.deleteDish = async (req, res) => {
  const { date, dish } = req.body;
  try {
    const menu = await Menu.findOne({ date });
    if (!menu) {
      return res.status(404).json({ error: "Menu introuvable" });
    }

    menu.dishes = menu.dishes.filter((d) => d !== dish);
    await menu.save();
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// 📌 Supprimer un menu entier
exports.deleteMenu = async (req, res) => {
  const { date } = req.params;
  try {
    const menu = await Menu.findOneAndDelete({ date });
    if (!menu) {
      return res.status(404).json({ error: "Menu introuvable" });
    }
    res.json({ message: "Menu supprimé" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};
exports.getTodayMenu = async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0]; // Get today's date in "YYYY-MM-DD" format
  console.log(today)
      // Find the menu for today
      const menu = await Menu.findOne({ date: today });
  
      if (!menu) {
        return res.status(404).json({ error: "Menu du jour introuvable" }); // Menu not found
      }
  
      // Respond with the menu (can include dishes or other data)
      res.json([menu]); // Wrap in an array to match the expected format in the Flutter app
    } catch (err) {
      res.status(500).json({ error: "Erreur serveur" }); // Server error
    }
  };