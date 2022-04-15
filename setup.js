const dgraph = require("./controllers/dgraph-graphql");
const schema = require("./schema");

dgraph.updateSchema(schema).then( s => {
  console.log("Schema updated successfully")
}).catch( e => {
  console.log(e)
});

// let q = dgraph.insert("Diagnosis", {dId: "0xd1d", title: "General Diagnosis", comment: "General Diagnosis"}, ["dId"])
// dgraph.run(q).then(x => {
//   console.log(x.updatePrescription.prescription)
// })