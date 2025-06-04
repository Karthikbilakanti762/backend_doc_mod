
const mongoose = require('mongoose');

const VitalsSchema = new mongoose.Schema({
    weight: Number,
    bloodPressure: String,
    heartRate: Number,
    spO2: Number,
    
});

const PatientSchema = new mongoose.Schema({
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    phone: { type: String },
    image: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files' },
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files' }, 
    visits: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Visit' }],
    labReports: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LabReport' }],
    createdAt: { type: Date, default: Date.now }
  }); 

const NurseSchema = new mongoose.Schema({
    name: String,
    email: {
        type: String,
        required: true,
        unique: true
      },
    password: {
        type: String,
        required: true
      }
});

const DoctorSchema = new mongoose.Schema({
    name: String,
    email: {
        type: String,
        required: true,
        unique: true
      },
    password: {
        type: String,
        required: true
      }
});

const VisitSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    visitDate: Date,
    vitals: VitalsSchema,
    doctorNote: { title: String, content: String },
    diagnosis: String,
    labReports: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LabReport' }],
    prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' }
});

const LabReportSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    testName: String,
    testDate: { type: Date, default: Date.now },
    result: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files' },
    visitId : {type:mongoose.Schema.Types.ObjectId, ref: 'Visit'}
});

const MedicineSchema = new mongoose.Schema({
    name: String,
    dosage: String,
    duration: String,
    instructions: String
});

const PrescriptionSchema = new mongoose.Schema({
    medicines: [MedicineSchema]
});

module.exports = {
    Patient: mongoose.model('Patient', PatientSchema),
    Nurse: mongoose.model('Nurse', NurseSchema),
    Doctor: mongoose.model('Doctor', DoctorSchema),
    Visit: mongoose.model('Visit', VisitSchema),
    LabReport: mongoose.model('LabReport', LabReportSchema),
    Medicine: mongoose.model('Medicine', MedicineSchema),
    Prescription: mongoose.model('Prescription', PrescriptionSchema)
};
