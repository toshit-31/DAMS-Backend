const dgraph = require("./dgraph-graphql");
const validate = require("./validate");
const crypto = require("crypto")
const jwt = require("jsonwebtoken");
const queries = require("./queries/lab");
const { InvalidData, InsufData, InsufParam, InsufQuery, NodeNotFound, parseError } = require("./errors");

const checkLab = validate({
  fullName: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
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
  email: {
    type: String
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
  test: {
    type: Array,
    required: true,
    validated(arr){
      return arr.every( t => checkTest(t))
    }
  },
  testDate: {
    type: String,
    required: true,
    validation(val){
      let td = new Date(val).toISOString();
      let cd = new Date().toISOString();
      return cd < td
    }
  },
  taxPercent: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  }
})

const createQuote = function(quote){
  const DOCCOM = 0.05, PLATCOM = 0.05;

  //
  quote.prescription = {presId: quote.presId};
  quote.patient = {patId: quote.patId};
  quote.doctor = {docId: quote.docId};
  quote.quotable = {quotableId: quote.quotableId};
  quote.status = "e:PENDING";
  delete quote.presId, delete quote.patId, delete quote.docId, delete quote.quotableId;

  //
  quote.date = new Date().toISOString();
  quote.totalTax = (quote.taxPercent/100) * quote.amount;
  quote.amount += quote.totalTax;
  quote.platformCom = quote.amount*PLATCOM;
  quote.doctorCom = quote.amount*DOCCOM;
  quote.netEarning = quote.amount - (quote.platformCom+quote.doctorCom)
  return quote;
}

module.exports = {
  async addLab(req, res){
    try {
      let lab = checkLab(req.body);
      lab.password = crypto.createHash("SHA256").update(lab.password).digest("hex");
      let q = dgraph.insert("Lab", lab, ["labId"]);
      let r = await dgraph.run(q);
      res.json(r.addLab.lab[0])
    } catch(e){
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async createLabSession(req, res){
    try {
      let {phone, pass} = req.body;
      if(!phone || !pass) throw new InsufData("'phone' and 'pass' fields are mandatory")
      let q = dgraph.get("Lab", "phone", phone, ["labId", "phone", "password", "fullName"]);
      let r = await dgraph.run(q);
      let lab = r.getLab, token;
      if(lab){
        let passHash = crypto.createHash("SHA256").update(pass).digest("hex");
        if(passHash == lab.password){
          token = jwt.sign({"id": lab.labId, "userType": "LAB"}, "secret_key");
          q = dgraph.updateUpsert("Auth", {userId: lab.labId, userType: 3, token}, ["userId", "token"]);
          r = await dgraph.run(q);
        } 
        if(lab && token){
          return res.json({
            user: {
              id: lab.labId,
              loginId: lab.phone,
              fullName: lab.fullName
            },
            token
          })
        } else return res.status(403).json({
          msg: "Incorrect Password"
        })
      } else return res.status(500).json({
        msg: "phone not registered as LAB"
      })
    } catch (e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async getQuotables(req, res){
    let labId = req.user.id;
    try {
      let {skip, limit} = req.query;
      let q = queries.getQuotables(skip, limit);
      let r = await dgraph.run(q);
      let quotables = r.queryQuotable;
      res.json({
        count: quotables.length,
        limit,
        offset: skip,
        quotables
      })
    } catch(e){
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async getQuote(req, res){
    try {
      let {quotableId} = req.params;
      let q = dgraph.get("Quotable", "quotableId", quotableId, ["quotableId", ["patient", "fullName", "phone"], ["prescription", ["test", "name", "part", "comment"]], "date"]);
      let r = await dgraph.run(q);
      if(!r.getQuotable) throw new NodeNotFound(quotableId, "quotableId")
      res.json(r.getQuotable);
    } catch(e){
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async sendQuotes(req, res){
    let labId = req.user.id;
    try{
      let userQuote = checkQuote(req.body);
      let labQuote = createQuote(userQuote);
      labQuote.lab = {labId};
      let q = dgraph.get("Quotable", "quotableId", labQuote.quotable.quotableId, ["quotableId"]);
      let r = await dgraph.run(q);
      if(!r.getQuotable) throw new NodeNotFound(labQuote.quotableId, "quotableId")
      q = dgraph.insert("LabQuote", labQuote, ["lqId"]);
      r = await dgraph.run(q);
      let {lqId} = r.addLabQuote.labQuote[0];
      q = dgraph.update("Lab", {filter: {labId}, set: {bidsMade: {lqId}}}, ["labId"])
      r = await dgraph.run(q);
      res.json({
        success: true,
        lqId
      })
    } catch(e){
      console.log(e)
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async confirmedLabQuote(req, res){
    let labId = req.user.id;
    try {
      // if(!s) throw new Error("status query not present")
      let q = queries.queryQuotesByStatus(labId, "CONFIRMED");
      let r = await dgraph.run(q);
      let lab = r.getLab;
      return res.json({
        labId,
        confirmed: lab.bidsConfirmed
      });
    } catch(e) {
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async completeQuote(req, res){
    let lqId = req.body.lqId;
    try {
      if(!lqId) throw new InsufData("'lqId' field is missing");
      let q = dgraph.update("LabQuote", {filter: {lqId}, set: {status: "e:COMPLETED"}}, ["lqId"]);
      let r = await dgraph.run(q);
      if(r.updateLabQuote.labQuote[0] == null) throw new NodeNotFound(lqId, "lqId")
      res.json({
        success: true,
        lqId
      })
    } catch(e){
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  }
}