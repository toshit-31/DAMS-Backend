module.exports = `
enum Specialization{GMD, CHS, ENT, CAR}

type Doctor {
  docId: ID!
  fullName: String!
  phone: String! @id
  email: String! @id
  password: String!
  specialization: Specialization! @search
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

type Auth {
  userId: String! @id
  userType: Int!
  token: String!
}

type Diagnosis {
  dId: ID!
  title: String!
  comment: String!
  prescription: Prescription!
}

type Prescription {
  presId: ID!
  specialization: Specialization! @search
  date: DateTime! @search(by: [day])
  time: DateTime! @search
  diagnosis: Diagnosis @hasInverse(field: prescription)
  doctor: Doctor! @hasInverse(field: prescriptions)
  patient: Patient! @hasInverse(field: prescriptions)
  medicine: [MedItem!]
  test: [LabTest!]
  complain: String
  history: String
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
`