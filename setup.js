const dgraph = require("./controllers/dgraph-graphql");
const schema = require("./schema");

// dgraph.updateSchema(schema).then( s => {
//   console.log("Schema updated successfully")
// }).catch( e => {
//   console.log(e)
// });

let q = dgraph.update("Prescription", {filter: {presId: "0x1adbc"}, set: {quotable: 0}}, ["presId"])
dgraph.run(q).then(x => {
  console.log(x.updatePrescription.prescription)
})