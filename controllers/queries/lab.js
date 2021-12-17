module.exports = {
  getQuotables(skip, limit){
    if(!skip) skip = 0;
    limit = ( parseInt(limit) && limit != 0 ) ? `, first: ${parseInt(limit)}` : "";
    return `query{
      queryQuotable(filter: {type: {in: [LAB]}}, offset: ${skip} ${limit}){
        quotableId
        prescription {
          test {
            name
          }
        }
        patient{
          phone
          fullName
          patId
        }
        date
      }
    }`
  },

  queryQuotesByStatus(labId, quoteStatus){
    if(!labId) throw new Error("Pharmacy Id is missing");
    return `query {
      getLab(labId: "${labId}"){
        labId
        bidsConfirmed (filter: {status: {eq: ${quoteStatus}}}){
          date
          testDate
          patient {
            patId
            fullName
            phone
          }
          amount
        }
      }
    }`
  }
}