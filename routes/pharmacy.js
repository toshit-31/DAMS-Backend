const express = require("express");
const app = express.Router();
const multer = require("multer");
const path = require("path")
const auth = require("../controllers/auth");


const pharmaController = require("./../controllers/pharmacy")
const invController = require("./../controllers/inventory") 

let pharmaLogo = multer({
  storage: multer.diskStorage({
    filename: (req, file, cb) => {
      cb(null, "lgp_"+req.body.phone+"."+file.mimetype.split("/")[1]);
    },
    destination: path.join(__dirname, "..", "uploads", "logo")
  })
})

app.post("/register", pharmaLogo.single("logo"), pharmaController.addPharmacy);
app.post("/login", pharmaController.createPharmaSession)
app.get("/quotables", auth.pharmaAuth, pharmaController.getQuotables)
app.get("/quotable/:quotableId", auth.pharmaAuth, pharmaController.getQuote)
app.post("/quote", auth.pharmaAuth, pharmaController.sendQuotes)
app.get("/quote/pending", auth.pharmaAuth, pharmaController.pendingQuote)
app.get("/quote/confirm", auth.pharmaAuth, pharmaController.confirmedPharmacyQuote)
app.get("/quote/completed", auth.pharmaAuth, pharmaController.completedQuote)
app.post("/quote/ready", auth.pharmaAuth, pharmaController.readyQuote)
app.post("/quote/complete", auth.pharmaAuth, pharmaController.completeQuote)
app.post("/inventory", auth.pharmaAuth, invController.addItem);
app.get("/inventory", auth.pharmaAuth, invController.getItems);
app.put("/inventory/:itemId/:addStock", auth.pharmaAuth, invController.updateInStock);

module.exports = app;