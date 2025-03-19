const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const upload = require("../middleware/upload");

router.get("/", menuController.getMenus); // 📌 Récupérer tous les menus
router.post("/", menuController.addMenu); // 📌 Ajouter un menu
router.post("/dish",upload.single("image"), menuController.addDish); // 📌 Ajouter un plat
router.put("/dish", menuController.editDish); // 📌 Modifier un plat
router.delete("/dish", menuController.deleteDish); // 📌 Supprimer un plat
router.delete("/:date", menuController.deleteMenu); // 📌 Supprimer un menu entier
router.get("/today", menuController.getTodayMenu); // 📌 Récupérer le menu du jour (today's menu)
module.exports = router;
