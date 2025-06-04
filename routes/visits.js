const express = require('express');
const router = express.Router();
const { Visit, Prescription } = require('../models/schemas');


const mongoose = require('mongoose'); // 👈 make sure this is imported


// GET visits for a patient
router.get('/all/diagnoses', async (req, res) => {
  try {
    const diagnoses = await Visit.distinct('diagnosis', { 
  diagnosis: { $exists: true, $nin: ['', null] } 
});

    res.json({ diagnoses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/:visitId', async (req, res) => {
  const { visitId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(visitId)) {
      return res.status(400).json({ error: 'Invalid visit ID format' });
    }

    const visit = await Visit.findById(visitId).populate('prescriptionId')
.populate('labReports')

    if (!visit) {
      return res.status(404).json({ message: 'Visit not found' });
    }

    res.json(visit);
  } catch (error) {
    console.error('Error fetching visit:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/patient/:patientId', async (req, res) => {
  const { patientId } = req.params;
  

  try {
      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
          return res.status(400).json({ error: 'Invalid patient ID format' });
      }

      const visits = await Visit.find({ 
          patientId: new mongoose.Types.ObjectId(patientId) 
      })
      .populate('prescriptionId')
.populate('labReports')

      res.json(visits);
  } catch (err) {
      console.error('Error fetching visits:', err);
      res.status(500).json({ error: 'Server error', details: err.message });
  }
});



router.put('/:visitId/notes', async (req, res) => {
    const { visitId } = req.params;
    const { doctorNote } = req.body;
  
    try {
      const updatedVisit = await Visit.findByIdAndUpdate(
        visitId,
        { doctorNote: {
          title: doctorNote.title || '',
          content: doctorNote.content || ''
        } },
        { new: true }
      );
  
      if (!updatedVisit) {
        return res.status(404).json({ message: 'Visit not found' });
      }
  
      res.json(updatedVisit);
    } catch (error) {
      console.error('Error updating clinical notes:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  router.post('/:visitId/prescription', async (req, res) => {
    const { visitId } = req.params;
    const { medicines, duration, instructions } = req.body;
  
    try {
      // Step 1: Create a new prescription document
      const prescription = new Prescription({
        medicines,
        duration,
        instructions,
      });
  
      await prescription.save();
  
      // Step 2: Attach the prescription to the visit
      const updatedVisit = await Visit.findByIdAndUpdate(
        visitId,
        { prescriptionId: prescription._id },
        { new: true },
      ).populate('prescriptionId'); // optional: populate the prescription details in response
  
      if (!updatedVisit) {
        return res.status(404).json({ message: 'Visit not found' });
      }
  
      res.json(updatedVisit);
    } catch (error) {
      console.error('❌ Error adding prescription:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { diagnosis } = req.body;

  try {
    const updatedVisit = await Visit.findByIdAndUpdate(
      id,
      { diagnosis },
      { new: true } // Return the updated document
    );

    if (!updatedVisit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    res.status(200).json(updatedVisit);
  } catch (error) {
    console.error('Error updating diagnosis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


  
module.exports = router;
