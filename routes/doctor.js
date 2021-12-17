const express = require("express");
const app = express.Router();
const multer = require("multer");
const path = require("path")
const auth = require("../controllers/auth");

const docController = require("./../controllers/doctor")

let docLogo = multer({
  storage: multer.diskStorage({
    filename: (req, file, cb) => {
      cb(null, "lgd_"+req.body.phone+"."+file.mimetype.split("/")[1]);
    },
    destination: path.join(__dirname, "..", "uploads", "logo")
  })
})

app.post("/register", docLogo.single("logo"), docController.addDoctor);
app.post("/login", docController.createDoctorSession);
app.post("/appointments", docController.addAppointment);
app.get("/appointments", auth.doctorAuth, docController.getAppointments);
app.put("/appointment/not-attended/", auth.doctorAuth, docController.appointmentNotAttended)
app.post("/appointment/attended/", auth.doctorAuth, docController.appointmentAttended)
app.post("/prescription/write", auth.doctorAuth, docController.assignPrescription)
app.get("/patients", auth.doctorAuth, docController.getPatient)
app.post("/patient/info/", auth.doctorAuth, docController.getPatientInfo)
app.get("/patient/:patId", auth.doctorAuth, docController.getPatientRecord)
// meds
app.post("/medicine", auth.doctorAuth, docController.addMedicine);
app.get("/medicine", auth.doctorAuth, docController.getMedicine);
app.delete("/medicine", auth.doctorAuth, docController.deleteMedicine);

module.exports = app;