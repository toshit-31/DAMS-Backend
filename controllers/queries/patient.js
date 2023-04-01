module.exports = {
  filterPrescription(opt){
    console.log(opt);
    return `
    query {
      getPatient(patId: "${opt.patId}"){
        patId
        doctors${opt.specialization ? `(filter: {specialization: {eq : ${opt.specialization}}})` : ""}{
          docId
          fullName
          patients(filter: {patId: "${opt.patId}"}){
            prescriptions${Object.keys(opt.date || {}).length == 2 ? `(filter: {${opt.specialization ? `doctor: {specialization: {eq : ${opt.specialization}}},` : ""} date: {between: {min: "${opt.date.min}", max: "${opt.date.max}"}}})` : ""} {
              presId
              doctor {
                docId
                fullName
                specialization
              }
              diagnosis {
                title
                comment
              }
              date
              medicine {
                name
                mor
                aft
                evn
                days
              }
              test {
                name
                part
              }
              complain
              history
            }
          }
        }
      }
    }`
  },
  //${opt.date && opt.date.min && opt.date.max ? `, date: {between: {min: "${opt.date.min}", max: "${opt.date.max}"}}}` : ""}}
  filterPrescription2(opt){
    console.log(opt);
    return `
    query {
      getPatient(patId: "${opt.patId}"){
        patId
        prescriptions(filter: {${opt.specialization ? `specialization: {eq : ${opt.specialization}}` : ""}){
          presId
          specialization
          doctor {
            docId
            fullName
            specialization
          }
          diagnosis {
            title
            comment
          }
          date
          medicine {
            name
            mor
            aft
            evn
            days
          }
          test {
            name
            part
          }
          complain
          history
        }
      }
    }`
  }
}