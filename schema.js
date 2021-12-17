module.exports = `
type Doctor {
  docId: ID!
  fullName: String!
  phone: String! @id
  email: String! @id
  password: String!
  regNumber: String! @id
  status: Boolean
  medList: [String!]
  diagnosticList: [String!]
  prescriptions: [Prescription!] @hasInverse(field: doctor)
  patients: [Patient!]
  appointments: [Visit!]
}

type Patient {
  patId: ID!
  fullName: String! @search(by: [term])
  password: String!
  phone: String! @id
  email: String
  passChanged: Int!
  prescriptions: [Prescription!] @hasInverse(field: patient)
  doctors: [Doctor!] @hasInverse(field: patients)
  diagnosis: [Diagnosis!]
}

type PasswordChange {
  token: ID!
  userId: String! @id
}

type Diagnosis {
  dId: ID!
  title: String!
  comment: String!
  prescription: Prescription!
}

type Pharmacy {
  pharmaId: ID!
  fullName: String! @search(by: [term])
  password: String!
  phone: String! @id
  email: String
  address: String!
  pincode: Int!
  inventory: [InvItem!] @hasInverse(field: pharmacy)
  bidsMade: [PharmacyQuote!]
  bidsConfirmed: [PharmacyQuote!]
}

type Lab {
  labId: ID!
  fullName: String! @search(by: [term])
  password: String!
  phone: String! @id
  email: String
  address: String!
  pincode: Int!
  bidsMade: [LabQuote!]
  bidsConfirmed: [LabQuote!]
}

type Prescription {
  presId: ID!
  date: DateTime! @search
  time: DateTime! @search
  diagnosis: Diagnosis! @hasInverse(field: prescription)
  doctor: Doctor! @hasInverse(field: prescriptions)
  patient: Patient! @hasInverse(field: prescriptions)
  medicine: [MedItem!]
  test: [LabTest!]
  complain: String
  history: String
  quotable: Int!
  bidPharmacyQuotes: [PharmacyQuote!]
  confirmedPharmacyQuote: PharmacyQuote
  bidLabQuotes: [LabQuote!]
  confirmedLabQuote: LabQuote
}

type LabTest {
  name: String!
  part: String!
  comment: String
}

type MedItem {
  name: String!
  mor: Int
  aft: Int
  evn: Int
  days: Int!
}

type Visit {
  visId: ID!
  doctor: Doctor! @hasInverse(field: appointments)
  phone: String! @search(by: [exact])
  fullName: String!
  date: DateTime!
  qnumber: Int!
}

type Auth {
  userId: String! @id
  userType: Int!
  token: String!
}

type PharmacyBill {
  name: String!
  qty: Int!
  rate: Float!
  amount: Float!
}

enum QuotePrepare { PICKUP, HOME }
enum QuoteType { PHARMACY , LAB }
enum QuoteStatus { PENDING, CONFIRMED, READY, COMPLETED }

type Quotable {
  quotableId: ID!
  prescription: Prescription!
  patient: Patient!
  date: DateTime!
  prepare: QuotePrepare! @search
  type: [QuoteType!] @search
  address: String
  pincode: Int
}

type PharmacyQuote {
  pqId: ID!
  quotable: Quotable!
  prescription: Prescription! @hasInverse(field: bidPharmacyQuotes)
  patient: Patient!
  doctor: Doctor!
  pharmacy: Pharmacy!
  date: DateTime!
  confirmDate: DateTime @search(by: [day])
  bill: [PharmacyBill!]
  taxPercent: Float!
  totalAmount: Float!
  totalTax: Float!
  platformCom: Float!
  doctorCom: Float!
  netEarning: Float!
  availIn: String!
  status: QuoteStatus! @search
  prepare: QuotePrepare! @search
  address: String
  pincode: Int
}

type LabQuote {
  lqId: ID!
  quotable: Quotable!
  prescription: Prescription! @hasInverse(field: bidLabQuotes)
  patient: Patient!
  doctor: Doctor!
  lab: Lab!
  test: [LabTest!]
  date: DateTime! @search
  testDate: DateTime @search(by: [hour])
  amount: Float!
  taxPercent: Float!
  totalTax: Float!
  platformCom: Float!
  doctorCom: Float!
  netEarning: Float!
  status: QuoteStatus! @search
}

type InvItem {
  itemId: ID!
  pharmacy: Pharmacy!
  name: String! @search(by: [exact])
  inStock: Int!
  rate: Float!
  qty: String!
}
`