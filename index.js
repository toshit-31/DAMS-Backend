const docRoutes = require("./routes/doctor");
const patRoutes = require("./routes/patient")
const pharRoutes = require("./routes/pharmacy")
const labRoutes = require("./routes/lab")
const express = require("express");
const app = express();

const cors = require("cors");

app.use(cors({
  origin: "*"
}))

app.use(express.json())
app.use("/doctor", docRoutes);
app.use("/patient", patRoutes);
app.use("/pharmacy", pharRoutes)
app.use("/lab", labRoutes)

app.listen(8000, function(){
  console.log("Server Up @ 8000");
})
