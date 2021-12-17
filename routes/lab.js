const express = require("express");
const app = express.Router();
const multer = require("multer");
const path = require("path")
const auth = require("../controllers/auth");

const labController = require("./../controllers/lab")

let labLogo = multer({
  storage: multer.diskStorage({
    filename: (req, file, cb) => {
      cb(null, "lgl_"+req.body.phone+"."+file.mimetype.split("/")[1]);
    },
    destination: path.join(__dirname, "..", "uploads", "logo")
  })
})

app.post("/register", labLogo.single("logo"), labController.addLab);
app.post("/login", labController.createLabSession);
app.get("/quotables", auth.labAuth, labController.getQuotables);
app.get("/quotable/:quotableId", auth.labAuth, labController.getQuote);
app.post("/quote", auth.labAuth, labController.sendQuotes);
app.get("/quote/confirm", auth.labAuth, labController.confirmedLabQuote)
app.post("/quote/complete", auth.labAuth, labController.completeQuote)

module.exports = app;