module.exports = {
  searchPatient(docId, patName){
    return `query {
      getDoctor(docId: "${docId}"){
        docId
        patients (filter: {fullName: {anyofterms: "${patName}"}}){
          patId
          fullName
          phone
          prescriptions (order: {desc: time}, first: 1){
            date
            time
            diagnosis {
              title
            }
          }
        }
      }
    }`
  },

  patientRecords(docId, patId){
    return `query {
      getDoctor(docId: "${docId}"){
        patients (filter: {patId: "${patId}"}){
          patId
          fullName
          phone
          prescriptions {
            diagnosis {
              title
              comment
            }
            doctor {
              docId
            }
            presId
            date
            time
            medicine {
              name
              mor
              aft
              evn
              days
            }
            complain
            history
          }
        }
      }
    }`
  }
}