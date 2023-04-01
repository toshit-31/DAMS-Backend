const dgraph = require("./dgraph-graphql");
const validate = require("./validate");
const crypto = require("crypto")
const jwt = require("jsonwebtoken");
const queries = require("./queries/doctor");
const {InsufData, InsufParam, InsufQuery, NodeNotFound, parseError, InvalidData} = require("./errors");

const checkDoc = validate({
  fullName: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true
  },
  specialization: {
    type: String,
    required: true,
    validation(val){
      return val.startsWith("e:");
    }
  },
  password: {
    type: String,
    required: true
  }
})

const validateMed = validate({
  name: {
    type: String,
    required: true
  },
  mor: {
    type: Number,
    validation: (v) => v >= 0 && v <= 2 
  },
  aft: {
    type: Number,
    validation: (v) => v >= 0 && v <= 2 
  },
  evn: {
    type: Number,
    validation: (v) => v >= 0 && v <= 2 
  },
  days: {
    type: Number,
    required: true
  }
})

const checkTest = validate({
  name: {
    type: String,
    required: true
  },
  part: {
    type: String,
    required: true
  },
  comment: {
    type: String
  }
})

const checkPrescription = validate({
  presId: {
    type: String,
    required: true
  },
  diagnosis: {
    type: Object,
    required: true,
    validation: function(obj){
      if(!obj.title || !obj.comment) return false;
      return true;
    }
  },
  medicine: {
    type: Array,
    validation: (arr) => arr.every( medItem => validateMed(medItem))
  },
  test: {
    type: Array,
    validation(arr){
      return arr.every( t => checkTest(t))
    }
  },
  complain: {
    type: String
  },
  history: {
    type: String
  }
})

module.exports = {
  async addDoctor(req, res){
    try{
      let doctor = checkDoc(req.body);
      doctor.password = crypto.createHash("SHA256").update(doctor.password).digest("hex");
      let q = dgraph.insert("Doctor", doctor, ["docId"]);
      let r = await dgraph.run(q);
      res.json(r.addDoctor.doctor[0]);
    } catch(e){
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async createDoctorSession(req, res){
    try {
      let {phone, pass} = req.body;
      if(!phone || !pass) throw new InsufData("'phone' and 'pass' field both are mandatory for login")
      let q = dgraph.get("Doctor", "phone", phone, ["docId", "password", "phone", "fullName"]);
      let r = await dgraph.run(q);
      let token = "", doc = r.getDoctor;
      if(doc){
        if(crypto.createHash("SHA256").update(pass).digest("hex") == doc.password){
          token = jwt.sign({"id": doc.docId, "userType": "DOC"}, "secret_key");
          q = dgraph.updateUpsert("Auth", {userId: doc.docId, userType: 0, token}, ["userId", "token"])
          r = await dgraph.run(q);
        }
        if(r && token){
          return res.json({
            user: {
              id: doc.docId,
              loginId: doc.phone,
              fullName: doc.fullName
            },
            token
          })
        } else return res.status(403).json({
          msg: "Incorrect password"
        })
      } else return res.status(404).json({
        msg: "phone not registered as DOCTOR"
      })
    } catch(e) {
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async medicineList(req, res){
    let docId = req.user.id;
    try {
      let q = dgraph.get("Doctor", "docId", docId, ["medList"]);
      let r = await dgraph.run(q);
      let medList = r.getDoctor.medList;
      res.json({
        docId: docId,
        meds: medList
      })
    } catch(e){
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async addAppointment(req, res){
    let {fullName, phone} = req.body;
    let docPhone = req.body.doctorId;
    if(!docPhone) throw new InsufData("field doctorId is not present")
    if(!fullName || !phone || phone.length != 10) throw new InsufData("'name' and 'phone' field is mandatory, 'phone' should be 10 digits long");
    try{
      let q = dgraph.get("Doctor", "phone", docPhone, ["docId", ["appointments", "phone"]]);
      let r = await dgraph.run(q);
      let doc = r.getDoctor;
      if(!doc) throw new InvalidData("Invalid request")
      let visitDoc = {
        doctor: {
          docId: doc.docId 
        },
        phone,
        fullName,
        date: new Date( new Date().toDateString() ).toISOString(),
        qnumber: doc.appointments.length+1
      }
      q = dgraph.insert("Visit", visitDoc, ["qnumber", "phone", "fullName"])
      r = await dgraph.run(q);
      res.json(r.addVisit.visit[0]);
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async getAppointments(req, res){
    let docId = req.user.id;
    try {
      let q = dgraph.get("Doctor", "docId", docId, [["appointments", "visId", "phone", "fullName", "qnumber"]]);
      let r = await dgraph.run(q);
      let doc = r.getDoctor;
      if(!doc) res.sendStatus(401);
      return res.json({
        docId: docId,
        appointments: doc.appointments
      })
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async appointmentNotAttended(req, res){
    let visitId = req.query.vis;
    if(!visitId) throw new InsufQuery("'vis' query is mandatory")
    try {
      let q = dgraph.delete("Visit", {visId: visitId}, [["doctor", "docId"], "fullName", "qnumber", "visId"]);
      let r = await dgraph.run(q);
      let deletedVisit = r.deleteVisit.visit;
      if(deletedVisit.length > 0){
        return res.json({
          docId: deletedVisit[0].doctor.docId,
          visId: deletedVisit[0].visId,
          deleted: {
            fullName: deletedVisit[0].fullName,
            qnumber: deletedVisit[0].qnumber
          }
        })
      } else throw new NodeNotFound(visitId, "visId");
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async appointmentAttended(req, res){
    let {visId} = req.body, docId = req.user.id;
    try{
      if(!visId) throw new InsufData("'visId' field is missing");
      if(!docId) throw new InsufData("'docId' field is missing");
      // get detail of doc, for specialization
      let q = dgraph.get("Doctor", "docId", docId, ["specialization"])
      let r = await dgraph.run(q)
      let specialization = r.getDoctor.specialization
      // get detail of patient from visit node
      q = dgraph.get("Visit", "visId", visId, ["visId", "fullName", "date", "phone"])
      r = await dgraph.run(q);
      let visitData = r.getVisit;
      // check if a patient account already exists if yes retrieve patient id
      q = dgraph.get("Patient", "phone", visitData.phone, ["patId"]);
      r = await dgraph.run(q);
      let pat = r.getPatient;
      let patId;
      if(!pat){
        // if patient account not present creates one
        let patDoc = {
          fullName: visitData.fullName,
          phone: visitData.phone,
          password: crypto.createHash("SHA256").update("password").digest("hex"),
          passChanged: 0
        }
        q = dgraph.insert("Patient", patDoc, ["patId"]);
        r = await dgraph.run(q);
        let patient = r.addPatient.patient[0];
        patId = patient.patId;
      } else {
        patId = pat.patId
      }
      // creates a prescription, will be updated later, if discarded changes to be rolled back
      let presDoc = {
        date: visitData.date,
        time: new Date( new Date().getTime() ).toISOString(),
        doctor: {docId},
        patient: {patId},
        specialization: "e:"+specialization
      }
      q = dgraph.insert("Prescription", presDoc, ["presId"]);
      r = await dgraph.run(q);
      let pres = r.addPrescription.prescription[0];
      // creates a diagnosis for the prescription
      q = dgraph.insert("Diagnosis", {title: "No Diagnosis Summary", comment: "No Diagnosis Comment", prescription: {presId: pres.presId}}, ["dId"]);
      r = await dgraph.run(q);
      // update the prescription
      q = dgraph.update("Prescription", {filter: {presId: pres.presId}, set: {diagnosis: {dId: r.addDiagnosis.diagnosis[0].dId}}}, ["presId"]);
      r = await dgraph.run(q);
      // delete from visit
      q = dgraph.delete("Visit", {visId}, ["visId"]);
      r = await dgraph.run(q)
      return res.json({
        docId,
        presId: pres.presId,
        patId
      })
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async assignPrescription(req, res){
    try{
      let prescriptionData = checkPrescription(req.body);
      prescriptionData.quotable = 0;
      let {presId} = prescriptionData;
      delete prescriptionData.presId;

      // console.log(prescriptionData.history)
      if(prescriptionData.history) prescriptionData.history = prescriptionData.history.replace(/[\n]/g, "\\n"); 
      if(prescriptionData.complain) prescriptionData.complain = prescriptionData.complain.replace(/[\n]/g, "\\n");
      prescriptionData.diagnosis.comment = prescriptionData.diagnosis.comment.replace(/[\n]/g, "\\n");
      for(let i = 0; i < prescriptionData.test.length; i++) prescriptionData.test[i].comment = prescriptionData.test[i].comment.replace(/[\n]/g, "\\n");
      // let diagnosisData = prescriptionData.diagnosis;
      // diagnosisData.date = new Date().toISOString();
      // delete prescriptionData.diagnosis;

      let presUpdateDoc = {
        filter: { presId },
        set: prescriptionData
      }
      if(presUpdateDoc.set.medicine.length == 0) delete presUpdateDoc.set.medicine
      if(presUpdateDoc.set.test.length == 0) delete presUpdateDoc.set.test
      let q = dgraph.update("Prescription", presUpdateDoc, ["presId", ["patient", "patId"], ["diagnosis", "dId"]])
      let r = await dgraph.run(q);
      if(r.updatePrescription.prescription.length < 1) throw new NodeNotFound(presId, "presId");
      let patient = r.updatePrescription.prescription[0].patient;
      let linkDocPat = {filter: {docId: req.user.id}, set: {patients: {patId: patient.patId}}};
      
      // q = dgraph.update("Patient", {filter: {patId: patient.patId}, set: {diagnosis: diagnosisData}}, ["patId"]);
      // r = await dgraph.run(q);

      q = dgraph.update("Doctor", linkDocPat, [["patients", "patId"]])
      r = await dgraph.run(q);
      return res.json({
        success: true,
        presId,
        patId: patient.patId
      })
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async getPatient(req, res){
    let docId = req.user.id;
    let patName = req.query.name;
    try {
      // if(!patName) throw new InsufQuery("'name' query is missing");
      let q = !!patName ? queries.searchPatient(docId, patName) : queries.allPatients(docId);
      let r = await dgraph.run(q);
      let {patients} = r.getDoctor
      res.json(patients)
    } catch(e) {
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async getPatientInfo(req, res){
    let {param, value} = req.body;
    try {
      if(!param || !value) throw new InsufData("'param' and 'value' keys are mandatory")
      let results = null;
      switch(param.toLowerCase()){
        case "phone" : {
          let q = dgraph.get("Patient", "phone", value, ["patId", "fullName", "phone"]);
          let r = await dgraph.run(q);
          if(r.getPatient) result = r.getPatient;
          break;
        }
        case "patid" : {
          let q = dgraph.get("Patient", "patId", value, ["patId", "fullName", "phone"]);
          let r = await dgraph.run(q);
          if(r.getPatient) result = r.getPatient;
          break;
        }
        default:{
          throw new InvalidData("Invalid 'param' value")
        }
      }
      res.json({
        patientInfo : result
      })
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async getPatientRecord(req, res){
    let docId = req.user.id;
    let patId = req.params.patId;
    try {
      if(!patId) throw new InsufData("field 'patId' is mandatory")
      let q = queries.patientRecords(docId, patId);
      let r = await dgraph.run(q);
      if(r.getDoctor.patients.length < 1) throw new NodeNotFound(patId, "patId")
      let patient = r.getDoctor.patients[0];
      let prescriptions = r.getDoctor.patients[0].prescriptions.filter(e => {
        if (e.doctor.docId == docId) return e
      })
      res.json({
        patId: patient.patId,
        fullName: patient.fullName,
        phone: patient.phone,
        prescriptions,
        diagnosis: patient.diagnosis
      })
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async addMedicine(req, res){
    let docId = req.user.id;
    let {medicine} = req.body;
    try {
      let q = dgraph.update("Doctor", {filter: {docId}, set: {medList: [medicine]}}, ["docId", "medList"]);
      let r = await dgraph.run(q);
      res.json(r.updateDoctor.doctor)
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async getMedicine(req, res){
    let docId = req.user.id;
    try {
      let q = dgraph.get("Doctor", "docId", docId, ["docId", "medList"]);
      let r = await dgraph.run(q);
      res.json(r.getDoctor)
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async deleteMedicine(req, res){
    let docId = req.user.id;
    console.log(req.query)
    let {medicine} = req.query;
    try {
      if(!medicine) throw new InsufData("Query 'medicine' is mandatory")
      let q = dgraph.update("Doctor", {filter: {docId}, remove: {medList: [medicine]}}, ["docId", "medList"]);
      let r = await dgraph.run(q);
      res.json(r.updateDoctor.doctor)
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  }
}