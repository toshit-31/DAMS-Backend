const dgraph = require("./dgraph-graphql");
const validate = require("./validate");
const crypto = require("crypto")
const jwt = require("jsonwebtoken");
const queries = require("./queries/pharmacy");
const { InvalidData, InsufData, InsufParam, InsufQuery, NodeNotFound, parseError } = require("./errors");

const checkPharma = validate({
  fullName: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  pincode: {
    type: Number,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  }
})

const billItem = validate({
  name: {
    type: String,
    required: true
  },
  qty: {
    type: Number,
    required: true
  },
  rate: {
    type: Number,
    required: true
  }
})

const checkQuote = validate({
  presId: {
    type: String,
    required: true
  },
  patId: {
    type: String,
    required: true
  },
  docId: {
    type: String,
    required: true
  },
  quotableId: {
    type: String,
    required: true
  },
  bill: {
    type: Array,
    required: true,
    validation: (arr) => arr.every( e => billItem(e))
  },
  taxPercent: {
    type: Number,
    required: true
  },
  availIn: {
    type: String,
    required: true
  }
})

function createQuote(quote){
  const DOCCOM = 0.05, PLATCOM = 0.05;

  //
  quote.prescription = {presId: quote.presId};
  quote.patient = {patId: quote.patId};
  quote.doctor = {docId: quote.docId};
  delete quote.presId, delete quote.patId, delete quote.docId;

  //
  quote.date = new Date().toISOString();
  quote.totalAmount = 0;
  quote.bill = quote.bill.map( (e,i) => {
    e.amount = e.qty * e.rate;
    quote.totalAmount += e.amount;
    return e;
  })
  quote.totalTax = (quote.taxPercent/100) * quote.totalAmount;
  quote.totalAmount += quote.totalTax;
  quote.platformCom = quote.totalAmount*PLATCOM;
  quote.doctorCom = quote.totalAmount*DOCCOM;
  quote.netEarning = quote.totalAmount - (quote.platformCom+quote.doctorCom)
  return quote;
}

module.exports = {
  async addPharmacy(req, res){
    try {
      let pharma = checkPharma(req.body);
      pharma.password = crypto.createHash("SHA256").update(pharma.password).digest("hex");
      let q = dgraph.insert("Pharmacy", pharma, ["pharmaId"])
      let r = await dgraph.run(q);
      res.json(r.addPharmacy.pharmacy[0])
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async createPharmaSession(req, res){
    try {
      let {phone, pass} = req.body;
      if(!phone || !pass) throw new InsufData("'phone' and 'pass' fields are mandatory")
      let q = dgraph.get("Pharmacy", "phone", phone, ["pharmaId", "phone", "password", "fullName"]);
      let r = await dgraph.run(q);
      let pharma = r.getPharmacy, token;
      if(pharma){
        let passHash = crypto.createHash("SHA256").update(pass).digest("hex");
        if(passHash == pharma.password){
          token = jwt.sign({"id": pharma.pharmaId, "userType": "PHA"}, "secret_key");
          q = dgraph.updateUpsert("Auth", {userId: pharma.pharmaId, userType: 2, token}, ["userId", "token"]);
          r = await dgraph.run(q);
        } 
        if(pharma && token){
          return res.json({
            user: {
              id: pharma.pharmaId,
              loginId: pharma.phone,
              fullName: pharma.fullName
            },
            token
          })
        } else return res.status(403).json({
          msg: "Incorrect Password"
        })
      } else return res.status(404).json({
        msg: "phone not registered as PHARMACY"
      })
    } catch (e){
      e = parseError(e);
      console.log(e);
      res.status(e.code).json(e.e);
    }
  },

  async getQuotables(req, res){
    let pharmaId = req.user.id;
    let {home, pickup, offset, limit} = req.query;
    try {
      let q = queries.queryQuotables(offset, limit, home, pickup);
      let r = await dgraph.run(q);
      let quotables = r.queryQuotable;
      res.json({
        count: quotables.length,
        offset: parseInt(offset) || 0,
        limit: (parseInt(limit) || 0),
        quotables
      })
    } catch(e){
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  // async getQuotables(req, res){
  //   let pharmaId = req.user.id;
  //   let {prepare, page} = req.query;
  //   const count = 10;
  //   try {
  //     if(!["PICKUP", "HOME"].includes(prepare.toUpperCase())) throw new Error("Prepare field must have values either PICKUP or HOME");
  //     let quotables = [];
  //     while(quotables.length < count){
  //       let q = queries.getQuotables(count, (page-1)*count);
  //       let r = await dgraph.run(q);
  //       let unfiltered = r.queryQuotable;
  //       unfiltered.forEach( quotable => {
  //         if(
  //           quotable.type.includes("PHARMACY") && 
  //           quotable.prepare == prepare.toUpperCase()
  //         ) quotables.push(quotable)
  //       })
  //       page++;
  //       if(r.queryQuotable.length < count) break;
  //     }
  //     res.json({
  //       count: quotables.length,
  //       page,  
  //       quotables
  //     })
  //   } catch(e){
  //     console.log(e);
  //     res.status(500).json({
  //       msg: e.message
  //     })
  //   }
  // },


  async getQuote(req, res){
    let {quotableId} = req.params;
    try{
      if(!quotableId) throw new Error("'quotableId' query is missing");
      let q = dgraph.get("Quotable", "quotableId", quotableId, ["quotableId", "date", ["prescription", "presId", "date", ["doctor", "docId"], ["medicine", "name", "mor", "aft", "evn", "days"]], ["patient", "patId", "phone", "fullName"], "prepare", "address", "pincode"])
      let r = await dgraph.run(q);
      if(!r.getQuotable) throw new NodeNotFound(quotableId, "quotableId");
      res.json(r.getQuotable);
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async sendQuotes(req, res){
    try {
      let pharmaId = req.user.id;
      let userQuote = checkQuote(req.body);
      let pharmacyQuote = createQuote(userQuote);
      let q = dgraph.get("Quotable", "quotableId", userQuote.quotableId, [["prescription", "presId"], "prepare", "address", "pincode"]);
      let r = await dgraph.run(q);
      let quotable = r.getQuotable;
      if(!quotable) throw new InvalidData("'quotableId' is not present");
      if(quotable.prepare == "HOME"){
        pharmacyQuote = {
          ...pharmacyQuote,
          ...quotable
        }
      }
      pharmacyQuote.pharmacy = {pharmaId}
      pharmacyQuote.prepare = "e:"+quotable.prepare;
      pharmacyQuote.quotable = {quotableId: pharmacyQuote.quotableId};
      delete pharmacyQuote.quotableId;
      q = dgraph.insert("PharmacyQuote", pharmacyQuote, ["pqId"]);
      r = await dgraph.run(q);
      let {pqId} = r.addPharmacyQuote.pharmacyQuote[0];
      q = dgraph.update("Pharmacy", {filter: {pharmaId}, set: {bidsMade: {pqId}}}, ["pharmaId"])
      r = await dgraph.run(q);
      res.json({
        success: true,
        pqId
      });
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },
  
  async pendingQuote(req, res){
    let pharmaId = req.user.id;
    try {
      let q = queries.queryQuotesByStatus(pharmaId, "PENDING");
      let r = await dgraph.run(q);
      let pharma = r.getPharmacy;
      return res.json({
        pharmaId: pharma.pharmaId,
        pending: r.getPharmacy.bidsMade
      });
    } catch(e) {
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async completedQuote(req, res){
    let pharmaId = req.user.id;
    try {
      let q = queries.queryQuotesByStatus(pharmaId, "COMPLETED");
      let r = await dgraph.run(q);
      let pharma = r.getPharmacy;
      return res.json({
        pharmaId: pharma.pharmaId,
        completed: r.getPharmacy.bidsMade
      });
    } catch(e) {
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async confirmedPharmacyQuote(req, res){
    let pharmaId = req.user.id;
    try {
      let q = queries.queryQuotesByStatus(pharmaId, "CONFIRMED");
      let r = await dgraph.run(q);
      let pharma = r.getPharmacy;
      return res.json({
        pharmaId: pharma.pharmaId,
        confirmed: r.getPharmacy.bidsConfirmed
      });
    } catch(e) {
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async readyQuote(req, res){
    let pqId = req.body.pqId;
    try {
      if(!pqId) throw new InsufData("'pqId' is mandatory");
      let q = dgraph.update("PharmacyQuote", {filter: {pqId}, set: {status: "e:READY"}});
      let r = await dgraph.run(q);
      if(r.updatePharmacyQuote.pharmacyQuote.length == 0) throw new NodeNotFound(pqId, "pqId");
      res.json({
        success: true
      })
    } catch(e){
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async completeQuote(req, res){
    let pqId = req.body.pqId;
    try {
      if(!pqId) throw new InsufData("'pqId' field is missing");
      let q = dgraph.update("PharmacyQuote", {filter: {pqId}, set: {status: "e:COMPLETED"}}, ["pqId"]);
      let r = await dgraph.run(q);
      if(r.updatePharmacyQuote.pharmacyQuote[0] == null) throw new NodeNotFound(r.updatePharmacyQuote.pharmacyQuote[0].pqId, pqId, "pqId")
      res.json({
        success: true,
        pqId
      })
    } catch(e){
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  }
}