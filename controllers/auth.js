const jwt = require("jsonwebtoken");

const doctorAuth = async function(req, res, next){
  let token = req.headers.authorization;
  if(!token) return res.sendStatus(401);
  let verToken = jwt.verify(token, "secret_key", function(err, json){
    if(err){
      return res.sendStatus(401)
    }
    if (json.userType != "DOC") return res.sendStatus(401);
    req.user = json;
    next()
  })
}

const patientAuth = async function(req, res, next){
  let token = req.headers.authorization;
  if(!token) return res.sendStatus(401);
  let verToken = jwt.verify(token, "secret_key", function(err, json){
    if(err){
      return res.sendStatus(401)
    }
    if (json.userType != "PAT") return res.sendStatus(401);
    req.user = json;
    next()
  })
}

const pharmaAuth = async function(req, res, next){
  let token = req.headers.authorization;
  if(!token) return res.sendStatus(401);
  let verToken = jwt.verify(token, "secret_key", function(err, json){
    if(err){
      return res.sendStatus(401)
    }
    if (json.userType != "PHA") return res.sendStatus(401);
    req.user = json;
    next()
  })
}

const labAuth = async function(req, res, next){
  let token = req.headers.authorization;
  if(!token) return res.sendStatus(401);
  let verToken = jwt.verify(token, "secret_key", function(err, json){
    if(err){
      return res.sendStatus(401)
    }
    if (json.userType != "LAB") return res.sendStatus(401);
    req.user = json;
    next()
  })
}

module.exports = {
  doctorAuth,
  patientAuth,
  pharmaAuth,
  labAuth
}