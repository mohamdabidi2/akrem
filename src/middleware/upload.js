const multer = require("multer");

const storage = multer.memoryStorage(); // Stocker temporairement en mémoire
const upload = multer({ storage });

module.exports = upload;
