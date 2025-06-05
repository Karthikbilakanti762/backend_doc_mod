// server.js

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const bcrypt = require('bcrypt');

// Routes and middleware
const patientRoutes = require('./routes/patientRoutes');
const labRoutes = require('./routes/labreports');
const { handlePrescriptionRoute } = require("./routes/aipres");
const verifyToken = require('./middleware/verifyToken');
const clinicalNotesRoutes = require("./routes/notetitle");
const { router: imageRouter, initGridFS } = require('./routes/gridimages');
const advise = require('./routes/aiadvise');
const wasend = require('./routes/autosend');
const aides = require('./routes/aides');

// Models
const {
  Patient,
  Doctor,
  Nurse,
  Visit,
  Prescription,
  Medicine
} = require('./models/schemas');

// Express setup
const app = express();
app.use(bodyParser.json());
app.use(cors());

app.use('/uploads', express.static('uploads'));

// Mongo URI from env or fallback
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://sairushikpro:n7aBmx4HZc9iVusX@mycluster.vwgcj.mongodb.net/projectdb?retryWrites=true&w=majority&appName=mycluster';
createServer();
// Create server after DB connection
async function createServer() {
  try {
    await mongoose.connect(MONGO_URI, {
    });
    console.log('✅ MongoDB connected');

    initGridFS(mongoose.connection);
   
    

    // Register routes
    

    // Doctor Login
    app.post('/doctor/login', async (req, res) => {
      const { email, password } = req.body;
      try {
        const doctor = await Doctor.findOne({ email });
        if (!doctor ) {
          return res.status(401).json({ message: 'Incorrect email or password' });
        }
        const isMatch = await bcrypt.compare(password, doctor.password);
        if (!isMatch) {
          return res.status(401).json({ message: 'Incorrect email or password' });
        }

        const payload = { id: doctor._id, email: doctor.email };
        const token = jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: '1h' });

        res.status(200).json({
          token,
          doctor: {
            id: doctor._id,
            name: doctor.name,
            email: doctor.email,
          }
        });
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
      }
    });

    // Doctor Profile
    app.get('/doctor/profile', verifyToken, async (req, res) => {
      try {
        const doctor = await Doctor.findById(req.user.id).select('-password');
        if (!doctor) {
          return res.status(404).json({ message: 'Doctor not found' });
        }
        res.status(200).json({ doctor });
      } catch (error) {
        console.error('Profile fetch error:', error.message, error.stack);
        res.status(500).json({ message: 'Server error', error: error.message });
      }
    });

    // Start server
    app.listen(5000, '0.0.0.0', () => {
      console.log('🚀 Server running at http://localhost:5000');
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err);
  }
}

app.use('/api/patients', patientRoutes);
    app.use('/api/visits', require('./routes/visits'));
    app.use('/api/labs', labRoutes);
    app.use('/api/parse-prescription', handlePrescriptionRoute);
    app.use("/api/clinical-notes", clinicalNotesRoutes);
    app.use('/api/files', imageRouter);
    app.use('/api/groq-generate-advice',advise);
    app.use('/api/send-whatsapp',wasend);
    app.use('/api/generate-descriptions',aides);


