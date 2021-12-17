const express = require("express");
const app = express.Router();
const multer = require("multer");
const path = require("path")
const auth = require("../controllers/auth");

const patController = require("./../controllers/patient")

app.post("/login", patController.createPatientSession);
app.post("/password/", patController.changePassword);
app.get("/prescriptions", auth.patientAuth, patController.getPrescriptions)
app.post("/prescription/open", auth.patientAuth, patController.openForBidding)
app.get("/quotes/pharmacy/:presId", auth.patientAuth, patController.getPharmacyQuotes)
app.post("/quote/pharmacy/confirm", auth.patientAuth, patController.confirmPharmacyQuote)
app.get("/quotes/lab/:presId", auth.patientAuth, patController.getLabQuotes)
app.post("/quote/lab/confirm", auth.patientAuth, patController.confirmLabQuote)


module.exports = app;