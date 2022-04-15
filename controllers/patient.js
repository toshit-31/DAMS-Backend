const dgraph = require("./dgraph-graphql");
const validate = require("./validate");
const crypto = require("crypto")
const jwt = require("jsonwebtoken");
const queries = require("./queries/patient");
const { getQuotables } = require("./queries/pharmacy");
const { InsufData, NodeNotFound, InvalidData, InsufParam, parseError } = require("./errors");
// const queries = require("./queries/patient");

const checkQuotable = validate({
  prepare: {
    type: String,
    required: true,
    validation: (val) => {
      let enumVals = ["PICKUP", "HOME"];
      if(!val.startsWith("e:")) return false;
      if(!enumVals.includes(val.split(":")[1].toUpperCase())) return false
      return true
    }
  },
  type: {
    type: Array,
    required: true,
    validation: (arr) => {
      let enumVals = ["PHARMACY", "LAB"];
      return arr.every( e => enumVals.includes(e.split(":")[1].toUpperCase()))
    }
  },
  address: {
    type: String
  },
  pincode: {
    type: Number
  }
})

const deletePharmacyQuotesOtherThanConfirmed = async function(presId, pharmaId, pqId){
  try {
    let q = dgraph.get("Prescription", "presId", presId, [["bidPharmacyQuotes", "pqId"]]);
    let r = await dgraph.run(q);
    if(r.getPrescription){
      let pqIds = r.getPrescription.bidPharmacyQuotes.filter(quote => {return quote.pqId != pqId}).map( q => {return {pqId: q.pqId}});
      if(pqIds.length > 0){
        q = dgraph.update("Pharmacy", {filter: {pharmaId}, remove: {bidsMade: pqIds}}, ["pharmaId"])
        r = await dgraph.run(q);
        pqIds = pqIds.map(q => q.pqId)
        q = dgraph.delete("PharmacyQuote", {pqId: pqIds}, ["pqId"]);
        r = await dgraph.run(q);
      }
    } else throw new Error("Prescription Id missing")
  } catch(e){
    throw e
  }
}

const deleteLabQuotesOtherThanConfirmed = async function(presId, labId, lqId){
  try {
    let q = dgraph.get("Prescription", "presId", presId, [["bidLabQuotes", "lqId"]]);
    let r = await dgraph.run(q);
    if(r.getPrescription){
      let lqIds = r.getPrescription.bidLabQuotes.filter(quote => {return quote.lqId != lqId}).map( q => {return {lqId: q.lqId}});
      if(lqIds.length > 0){
        q = dgraph.update("Lab", {filter: {labId}, remove: {bidsMade: lqIds}}, ["labId"])
        r = await dgraph.run(q);
        lqIds = lqIds.map(q => q.lqId)
        q = dgraph.delete("LabQuote", {lqId: lqIds}, ["lqId"]);
        r = await dgraph.run(q);
      }
    } else throw new InsufData("'presId' field is mandartory")
  } catch(e){
    throw e
  }
}

module.exports = {
  async changePassword(req, res){
    let {pass, token} = req.body;
    try {
      if(!token) throw new InvalidData("Invalid token");
      let q = dgraph.get("PasswordChange", "token", token, ["token", "userId"]);
      let r = await dgraph.run(q);
      let auth = r.getPasswordChange;
      // console.log(auth)
      // check if the token is valid and in database
      if(!auth) throw new NodeNotFound(auth.token, "PasswordChangeToken")
      let hashedPass = crypto.createHash("SHA256").update(pass).digest("hex");
      q = dgraph.update("Patient", {filter: {patId: auth.userId}, set: {password: hashedPass, passChanged: 1}}, ["patId", "phone", "fullName"]);
      r = await dgraph.run(q);
      let loginId = r.updatePatient.patient[0].phone, fullName = r.updatePatient.patient[0].fullName;
      // generate session token
      let sessionToken = jwt.sign({"id": auth.userId, "userType": "PAT"}, "secret_key");
      q = dgraph.updateUpsert("Auth", {userId: auth.userId, userType: 1, token: sessionToken}, ["userId", "token"]);
      r = await dgraph.run(q);
      
      res.json({
        user: {
          id: auth.userId,
          loginId,
          fullName
        },
        token: sessionToken,
      })
      // delete password change token
      q = dgraph.delete("PasswordChange", {userId: auth.userId}, ["userId"]);
      r = await dgraph.run(q);
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async createPatientSession(req, res){
    try {
      let {phone, pass} = req.body;
      if(!phone || !pass) throw new Error("Phone Number and Password both are mandatory for login.")
      let q = dgraph.get("Patient", "phone", phone, ["patId", "phone", "password", "fullName", "passChanged"]);
      let r = await dgraph.run(q);
      let patient = r.getPatient, token;
      if(patient.passChanged == 0){
        q = dgraph.delete("PasswordChange", {userId: {eq:patient.patId}}, ["token"]);
        r = await dgraph.run(q);
        q = dgraph.insert("PasswordChange", {userId: patient.patId}, ["token"]);
        r = await dgraph.run(q);
        token = r.addPasswordChange.passwordChange[0].token;
        return res.json({patId: patient.patId, passChangeToken: token});
      }      
      if(patient){
        let passHash = crypto.createHash("SHA256").update(pass).digest("hex");
        if(passHash == patient.password){
          token = jwt.sign({"id": patient.patId, "userType": "PAT"}, "secret_key");
          q = dgraph.updateUpsert("Auth", {userId: patient.patId, userType: 1, token}, ["userId", "token"]);
          r = await dgraph.run(q);
        } 
        if(patient && token){
          return res.json({
            user: {
              id: patient.patId,
              loginId: patient.phone,
              fullName: patient.fullName
            },
            token
          })
        } else return res.status(403).json({
          msg: "Incorrect Password"
        })
      } else return res.status(404).json({
        msg: "Phone not registered as patient"
      })
    } catch (e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },
  
  async getPrescriptions(req, res){
    let patId = req.user.id;
    let query = req.query;
    try {
      let q;
      if(Object.keys(query).length != 0){
        let qObj = {patId};
        if(query.date_max && query.date_min) qObj.date = {max: query.date_max, min: query.date_min};
        if(query.specialization) qObj.specialization = query.specialization;
        q = queries.filterPrescription2(qObj);
      } else {
        q = dgraph.get("Patient", "patId", patId, ["patId", "fullName", ["prescriptions", "presId", ["doctor", "fullName", "specialization"], ["diagnosis", "title", "comment"], "date", ["medicine", "name", "mor", "aft", "evn", "days"], ["test", "name", "part"], "complain", "history", "quotable"]]);
      }
      let r = await dgraph.run(q);
      res.json(r.getPatient);
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async openForBidding(req, res){
    let presId = req.body.presId, patId = req.user.id;
    try {
      if(!presId) throw new InsufData("'presId' field is missing");
      let quotableDoc = checkQuotable(req.body);
      if(quotableDoc.prepare.toLowerCase() == "e:home" && (!req.body.address || !req.body.pincode)) throw new InsufData("'address' and 'pincode' required for home delivery requests")
      
      quotableDoc = {
        ...quotableDoc,
        prescription: {presId},
        patient: {patId},
        date: new Date().toISOString(),
      }
      let q = dgraph.insert("Quotable", quotableDoc, ["quotableId"]);
      let r = await dgraph.run(q);
      let quotable = r.addQuotable.quotable[0];
      q = dgraph.update("Prescription", {filter: {presId}, set: {quotable: 1}}, ["presId"]);
      r = await dgraph.run(q);
      if(r.updatePrescription.prescription.length < 1) throw new NodeNotFound(presId, "presId");
      res.json(quotable);
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async getPharmacyQuotes(req, res){
    let {presId} = req.params;
    try {
      if(!presId) throw new InsufParam("'presId' param is required");
      let q = dgraph.get("Prescription", "presId", presId, ["presId", ["bidPharmacyQuotes", "pqId", ["pharmacy", "fullName", "phone", "address", "pincode"], ["bill", "name", "qty", "amount"], "date", "totalAmount", "prepare", "availIn", "address", "pincode"]]);
      let r = await dgraph.run(q);
      res.json(r.getPrescription)
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async confirmPharmacyQuote(req, res){
    let {pqId} = req.body;
    try {
      if(!pqId) throw new InsufData("'pqId' field is required");
      let q = dgraph.get("PharmacyQuote", "pqId", pqId, ["pqId", ["quotable", "quotableId"], ["patient", "patId"], ["prescription", "presId", ["confirmedPharmacyQuote", "pqId"]], ["pharmacy", "pharmaId"]]);
      let r = await dgraph.run(q);
      if(r.getPharmacyQuote == null) throw new NodeNotFound(pqId, "pqId")
      if(r.getPharmacyQuote.prescription.confirmedPharmacyQuote != null) return res.status(500).json({
        msg: "Pharmacy Quote on this prescription is already confirmed"
      })
      let quotableId = r.getPharmacyQuote.quotable.quotableId;
      let pharmaId = r.getPharmacyQuote.pharmacy.pharmaId;
      let patId = r.getPharmacyQuote.patient.patId;
      let presId = r.getPharmacyQuote.prescription.presId;
      if(r.getPharmacyQuote){
        // add pharmacy quote to pharmacies db
        q = dgraph.update("Pharmacy", {filter: {pharmaId}, set: {bidsConfirmed: {pqId}}}, ["pharmaId"]);
        r = await dgraph.run(q);
        // add pharmacy quote to precription db
        try {
          q = dgraph.update("Prescription", {filter: {presId}, set: {confirmedPharmacyQuote: {pqId}, quotable: 0}}, ["presId"])
          r = await dgraph.run(q);
          // update pharmacy quote status to confirmed
          try {
            q = dgraph.update("PharmacyQuote", {filter: {pqId}, set: {status: "e:CONFIRMED", confirmDate: new Date().toISOString()}}, ["pqId"]);
            r = await dgraph.run(q);
            await deletePharmacyQuotesOtherThanConfirmed(presId, pharmaId, pqId);
            // delete quotable
            q = dgraph.delete("Quotable", {quotableId}, ["quotableId"]);
            r = await dgraph.run(q);
            
            res.json({
              success: true,
              pqId
            });
          } catch(e){
            q = dgraph.update("Prescription", {filter: {presId}, remove: {confirmedPharmacyQuote: {pqId}}}, ["presId"])
            r = await dgraph.run(q)
            throw e
          }
        } catch(e){
          console.log(e)
          // remove confirmed quote from pharmacy if failed to add to prescription
          q = dgraph.update("Pharmacy", {filter : {pharmaId}, remove: {bidsConfirmed: {pqId}}}, ["pharmaId"])
          r = await dgraph.run(q);
          throw e;
        }
      }
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async getLabQuotes(req, res){
    let {presId} = req.params;
    try {
      if(!presId) throw new InsufParam("'presId' param is required");
      let q = dgraph.get("Prescription", "presId", presId, ["presId", ["bidLabQuotes", "lqId", ["lab", "fullName", "phone", "address", "pincode"], ["test", "name", "part", "comment"], "testDate", "amount"]]);
      let r = await dgraph.run(q);
      if(!r.getPrescription) throw new NodeNotFound(presId, "presId");
      res.json(r.getPrescription)
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async confirmLabQuote(req, res){
    let {lqId} = req.body;
    try {
      if(!lqId) throw new InsufData("'lqId' field is required");
      let q = dgraph.get("LabQuote", "lqId", lqId, ["lqId", ["quotable", "quotableId"], ["patient", "patId"], ["prescription", "presId", ["confirmedLabQuote", "lqId"]], ["lab", "labId"]]);
      let r = await dgraph.run(q);
      if(r.getLabQuote == null) throw new NodeNotFound(pqId, "pqId")
      if(r.getLabQuote.prescription.confirmedLabQuote != null) return res.status(500).json({
        msg: "Lab Quote on this prescription is already confirmed"
      })
      let quotableId = r.getLabQuote.quotable.quotableId;
      let labId = r.getLabQuote.lab.labId;
      let patId = r.getLabQuote.patient.patId;
      let presId = r.getLabQuote.prescription.presId;
      if(r.getLabQuote){
        // add pharmacy quote to pharmacies db
        q = dgraph.update("Lab", {filter: {labId}, set: {bidsConfirmed: {lqId}}}, ["labId"]);
        r = await dgraph.run(q);
        // add pharmacy quote to precription db
        try {
          q = dgraph.update("Prescription", {filter: {presId}, set: {confirmedLabQuote: {lqId}, quotable: 0}}, ["presId"])
          r = await dgraph.run(q);
          // update pharmacy quote status to confirmed
          try {
            q = dgraph.update("LabQuote", {filter: {lqId}, set: {status: "e:CONFIRMED"}}, ["lqId"]);
            r = await dgraph.run(q);
            await deleteLabQuotesOtherThanConfirmed(presId, labId, lqId);
            // delete quotable
            q = dgraph.delete("Quotable", {quotableId}, ["quotableId"]);
            r = await dgraph.run(q);
            
            res.json({
              success: true,
              lqId
            });
          } catch(e){
            q = dgraph.update("Prescription", {filter: {presId}, remove: {confirmedPharmacyQuote: {pqId}}}, ["presId"])
            r = await dgraph.run(q)
            throw e
          }
        } catch(e){
          console.log(e)
          // remove confirmed quote from pharmacy if failed to add to prescription
          q = dgraph.update("Pharmacy", {filter : {pharmaId}, remove: {bidsConfirmed: {pqId}}}, ["pharmaId"])
          r = await dgraph.run(q);
          throw e;
        }
      } else throw new Error("Invalid PharmacyQuote Id")
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },
}