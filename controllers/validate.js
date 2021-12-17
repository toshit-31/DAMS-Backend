const {InvalidData} = require("./errors");

const validator = function(rule){
  let _keys = Object.keys(rule);
  let reqKeys = [];
  _keys.forEach( k => {
    if(!!rule[k].required) reqKeys.push(k)
  })
  return function(obj){
    let validated = {};
    // check if all required keys are present
    reqKeys.forEach( k => {
      if(!obj[k]) throw new InvalidData(`'${k}' key is required`);
    })
    // populating the validated object
    _keys.forEach(k => {
      // if key is not present in objected then value is set to empty String
      if(!obj[k]) {
        const xs = "", xn = 0;
        validated[k] = (rule[k].type == String || rule[k].type == Number) ? (rule[k].type == Number) ? 0 : "" : new (rule[k].type)()
        return
      };
      let val = obj[k];
      let formatedVal;
      if(!rule[k].type){ 
        formatedVal = val;
      } else {
        const dtype = rule[k].type;
        switch(dtype){
          case "ObjectId": {
            formatedVal = ObjectId(val)
          }
          case String: {
            formatedVal = new String(val).toString();
            break;
          }
          case Number: {
            if(isNaN(parseFloat(val))) throw new InvalidData(`${k} is not in correct format`);
            if(parseInt(val) == val) formatedVal = parseInt(val);
            else formatedVal = parseFloat(val);
            break;
          }
          case Array: {
            if(obj[k].constructor != Array) throw new InvalidData(`'${k}' expects an array`);
            if(!rule[k].element) {
              formatedVal = val;
            } else {
              let validArray = val.every( e => {
                return e.constructor == rule[k].element
              })
              if(validArray){
                formatedVal = val;
              } else throw new Error(`Array elements of key '${k}' doesn't match the required type`);
            }
            break
          }
          case Object: {
            if(obj[k].constructor != Object) throw new Error(`I'${k}' expects a object`);
            formatedVal = val;
            break
          }
          default: throw new InvalidData("Unknown Error");
        } 
      }
      // formatedVal is defined by this point
      if(rule[k].validation){
        if(!rule[k].validation.call(null, val)) throw new InvalidData(`Validation for field '${k}' failed`);
      }
      validated[k] = formatedVal;
    })
    return validated
  }
}

module.exports = validator;