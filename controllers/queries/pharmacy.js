module.exports = {
  queryQuotables(skip, limit, home, pickup){
    if(!skip) skip = 0;
    limit = ( parseInt(limit) && limit != 0 ) ? `, first: ${parseInt(limit)}` : ""
    let prepStr = "HOME, PICKUP";
    if(home) prepStr = "HOME";
    if(pickup) prepStr = "PICKUP";
    if(home && pickup) prepStr = "HOME, PICKUP"
    return `query {
      queryQuotable(filter: {prepare: {in: [${prepStr}]}}, offset: ${skip} ${limit}) {
        quotableId
        patient {
          fullName
          phone
        }
        date
        type
        prepare
        address
        pincode
      }
    }`
  },

  queryQuotesByStatus(pharmaId, quoteStatus){
    if(!pharmaId) throw new Error("Pharmacy Id is missing");
    return `query {
      getPharmacy(pharmaId: "${pharmaId}"){
        pharmaId
        bidsMade (filter: {status: {eq: ${quoteStatus}}}){
          date
          availIn
          confirmDate
          patient {
            patId
            fullName
            phone
          }
        }
      }
    }`
  }
}