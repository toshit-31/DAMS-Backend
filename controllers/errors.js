class InsufData extends Error {
  constructor(message){
    super(message);
    this.name = "InsufficientData";
    this.message = message;
  } 
}

class InvalidData extends Error {
  constructor(message){
    super(message);
    this.name = "InvalidData";
    this.message = message;
  } 
}

class InsufParam extends Error {
  constructor(message){
    super(message);
    this.name = "InsufficientParam";
    this.message = message;
  } 
}

class InsufQuery extends Error {
  constructor(message){
    super(message);
    this.name = "InsufficientQuery";
    this.message = message;
  } 
}

class NodeNotFound extends Error {
  constructor(nodeId, nodeKey){
    let message = `Node with ${nodeKey} value ${nodeId} was not found`
    super(message);
    this.name = "NodeNotFound";
    this.message = message;
  } 
}

class DBError extends Error {
  constructor(message){
    super(JSON.stringify(message));
    this.name = "DatabaseError";
    this.message = JSON.stringify(message);
  } 
}

function parseError(e){
  let code = 0;
  switch(e.name){
    case "InsufficientData":
    case "InsufficientParam":
    case "InsufficientQuery":
    case "InvalidData": {
      code = 400;
      break;
    }
    case "NodeNotFound" : {
      code = 404;
      break;
    }
    default : {
      code = 500;
      break;
    }
  }
  return {
    e: {
      error: e.name,
      msg: e.message
    },
    code
  }
}

module.exports = {
  InsufData,
  InvalidData,
  InsufParam,
  InsufQuery,
  NodeNotFound,
  DBError,
  parseError
}