const axios = require("axios").default;
const req = axios.create({
  baseURL: "http://localhost:8080/",
  headers: {
    "Content-type": "application/graphql"
  }
})
const {DBError} = require("./errors");

const arrayToGQLFields = function(arr){
  let str = "";
  for(let val of arr){
    if(val.constructor !== Array){ 
      str += val
    } else {
      let key = val.shift();
      str += `${key} { ${arrayToGQLFields(val)} }`
    }
    str+=","
  }
  str = str.substr(0, str.length-1);
  return str
}

const objectToGQLInput = function(obj){
  let str = "";
  for(let key in obj){
    if(obj[key].constructor !== Object){
      let val = obj[key];
      let isArray = false;
      switch(val.constructor){
        case Array: {
          let isObject = false;
          isArray = true;
          val = val.map( e => {
            if(e.constructor == Number) return e;
            if(e.constructor == String) return (e.startsWith("e:")) ? e.split(":")[1] : `"${e}"`;
            if(e.constructor == Object) {
              isObject = true;
              return objectToGQLInput(e);
            }
          })
          // val = !isObject ? val.toString() : `[${val.toString()}]`
          break;
        }
        case String: {
          val = val.startsWith("e:") ? val.split(":")[1] : `"${val}"`
        }
      }
      val = isArray ? `[${val}]` : val;
      str += key+":"+val+",";
    } else {
      str += key+":"+objectToGQLInput(obj[key])+","
    }
  }
  str = str.substr(0, str.length-1)
  str = "{"+str+"}" 
  return str
}

class DgraphGQL {
  static async getSchema(){
    const schemaQuery = 
    `query {
      getGQLSchema {
        schema
      }
    }`
    let res = await req.post("admin", JSON.stringify({query: schemaQuery}), {
      headers: {
        "Content-type": "application/json"
      }
    });
    let resData = res.data;
    let {data, errors} = resData;
    if(errors) throw new Error(errors[0].message);
    return data.getGQLSchema.schema
  }
  
  static async updateSchema(schema){
    const schemaQuery = 
    `mutation {
      updateGQLSchema(input: { set: { schema: ${JSON.stringify(schema)}}})
      {
        gqlSchema {
          schema
        }
      }
    }`
    let res = await req.post("admin", schemaQuery);
    let resData = res.data;
    let {data, errors} = resData;
    if(errors) throw new Error(errors[0].message);
    return true
  }

  static async run(queryStr){
    let res = await req.post("graphql", queryStr);
    let resData = res.data;
    let {data, errors} = resData;
    if(errors) {
      console.log(errors[0]);
      throw new DBError(errors[0])
    };
    return data;
  }

  static query(nodeType, filterObject, fields){
    nodeType = nodeType.toString();
    return `query{
      query${nodeType} (filter: ${objectToGQLInput(filterObject)}){
        ${arrayToGQLFields(fields)}
      }
    }`
  }

  static get(nodeType, k, v, fields){
    nodeType = nodeType.toString();
    return `query{
      get${nodeType} (${k}: "${v}"){
        ${arrayToGQLFields(fields)}
      }
    }`
  }

  static insert(nodeType, input, fields){
    nodeType = nodeType.toString()
    return `mutation {
      add${nodeType} (input: ${objectToGQLInput(input)}){
        ${nodeType.substr(0, 1).toLowerCase()+nodeType.substr(1)} {
         ${arrayToGQLFields(fields)}
        }
      }
    }`
  }

  static updateUpsert(nodeType, input, fields){
    nodeType = nodeType.toString()
    if(!fields) fields = [];
    return `mutation {
      add${nodeType} (input: ${objectToGQLInput(input)}, upsert: true){
        ${nodeType.substr(0, 1).toLowerCase()+nodeType.substr(1)} {
         ${arrayToGQLFields(fields)}
        }
      }
    }`
  }

  static update(nodeType, input, fields){
    nodeType = nodeType.toString()
    if(!fields) fields = [];
    return `mutation {
      update${nodeType} (input: ${objectToGQLInput(input)}){
        ${nodeType.substr(0, 1).toLowerCase()+nodeType.substr(1)} {
         ${arrayToGQLFields(fields)}
        }
      }
    }`
  }
  
  static delete(nodeType, input, fields){
    nodeType = nodeType.toString()
    if(!fields) fields = [];
    return `mutation {
      delete${nodeType} (filter: ${objectToGQLInput(input)}){
        ${nodeType.substr(0, 1).toLowerCase()+nodeType.substr(1)} {
         ${arrayToGQLFields(fields)}
        }
      }
    }`
  }
}

module.exports = DgraphGQL;