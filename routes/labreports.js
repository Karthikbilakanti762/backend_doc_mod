const express = require('express');
const router = express.Router();
const { LabReport, Patient, Visit } = require('../models/schemas');
const mongoose = require('mongoose');

// CREATE LAB REPORT
router.post('/', async (req, res) => {
  try {
    const { patientId, testName, visitId } = req.body;

    if (!patientId || !testName || !visitId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const newReport = new LabReport({
      patientId,
      testName,
      visitId
    });

    const savedReport = await newReport.save();

    // Add lab report to Patient
    await Patient.findByIdAndUpdate(patientId, {
      $push: { labReports: savedReport._id }
    });

    // Add lab report to the most recent visit (assuming visitId is provided and correct)
    await Visit.findByIdAndUpdate(visitId, {
      $push: { labReports: savedReport._id }
    });

    return res.status(201).json({ message: 'Lab report created successfully', report: savedReport });
  } catch (error) {
    console.error('Error creating lab report:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// DELETE LAB REPORT
router.delete('/:id', async (req, res) => {
  try {
    const report = await LabReport.findByIdAndDelete(req.params.id);

    if (!report) {
      return res.status(404).json({ message: 'Lab report not found' });
    }

    // Remove from Patient
    await Patient.findByIdAndUpdate(report.patientId, {
      $pull: { labReports: report._id }
    });

    // Remove from associated Visit
    await Visit.findByIdAndUpdate(report.visitId, {
      $pull: { labReports: report._id }
    });

    res.status(200).send({ message: 'Lab report deleted and reference removed from patient and visit' });
  } catch (error) {
    console.error('Error deleting lab report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET LAB REPORTS BY PATIENT ID
router.get('/patient/:patientId', async (req, res) => {
  const { patientId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ error: 'Invalid patient ID format' });
    }

    const labReports = await LabReport.find({ patientId: new mongoose.Types.ObjectId(patientId) });
    res.json(labReports);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
