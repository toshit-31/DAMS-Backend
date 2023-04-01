const dgraph = require("../controllers/dgraph-graphql.js")
const schema = require("schema.js")

dgraph.updateSchema(schema).then((res) =>{
  console.log(res)
}).catch((err)=>{
  console.err(err)
})
