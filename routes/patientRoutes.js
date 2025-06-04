const express = require('express');
const router = express.Router();
const { Patient, Prescription, Visit } = require('../models/schemas.js');
const mongoose = require('mongoose');

// GET /api/patients/search?q=searchTerm
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    console.log('Search query:', query);

    if (!query || query.trim() === '') {
      return res.status(400).json({ message: 'Search query is required.' });
    }

    const patients = await Patient.find({
      name: { $regex: query, $options: 'i' }
    }).select('gender age image name _id');

    res.json(patients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during search.' });
  }
});

// Main patients endpoint with improved diagnosis filtering
router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      gender,
      minAge,
      maxAge,
      from,
      to,
      sort = 'createdAt',
      page = 1,
      limit = 6,
      diagnosis
    } = req.query;

    console.log('=== FILTER REQUEST ===');
    console.log('All params:', req.query);
    console.log('Diagnosis param:', `"${diagnosis}"`);

    let query = {};

    // Handle diagnosis filtering FIRST
    if (diagnosis && diagnosis.trim() !== '' && diagnosis !== 'All Diagnoses') {
      const diagnosisQuery = diagnosis.trim();
      console.log('Searching for diagnosis:', `"${diagnosisQuery}"`);
      
      // Try multiple search patterns
      let visitsWithDiagnosis = [];
      
      // Pattern 1: Exact case-insensitive match
      visitsWithDiagnosis = await Visit.find({
        diagnosis: new RegExp(`^${diagnosisQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      }).select('patientId diagnosis').lean();
      
      console.log('Pattern 1 (exact):', visitsWithDiagnosis.length);
      
      // Pattern 2: Partial match if exact didn't work
      if (visitsWithDiagnosis.length === 0) {
        visitsWithDiagnosis = await Visit.find({
          diagnosis: new RegExp(diagnosisQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        }).select('patientId diagnosis').lean();
        console.log('Pattern 2 (partial):', visitsWithDiagnosis.length);
      }
      
      // Pattern 3: Remove parentheses and try again
      if (visitsWithDiagnosis.length === 0 && diagnosisQuery.includes('(')) {
        const cleanQuery = diagnosisQuery.replace(/\s*\([^)]*\)\s*/g, '').trim();
        visitsWithDiagnosis = await Visit.find({
          diagnosis: new RegExp(cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        }).select('patientId diagnosis').lean();
        console.log('Pattern 3 (no parentheses):', visitsWithDiagnosis.length);
      }
      
      console.log('Found visits with diagnosis:', visitsWithDiagnosis.length);
      console.log('Sample visits:', visitsWithDiagnosis.slice(0, 3));

      if (visitsWithDiagnosis.length > 0) {
        const patientIds = visitsWithDiagnosis
          .map(v => v.patientId)
          .filter(id => id) // Remove null/undefined
          .map(id => new mongoose.Types.ObjectId(id));
        
        // Remove duplicates
        const uniquePatientIds = [...new Set(patientIds.map(id => id.toString()))]
          .map(id => new mongoose.Types.ObjectId(id));
        
        console.log('Unique patient IDs:', uniquePatientIds.length);
        
        query._id = { $in: uniquePatientIds };
      } else {
        console.log('No visits found with this diagnosis, returning empty result');
        return res.json({
          patients: [],
          total: 0,
          page: Number(page),
          totalPages: 0,
        });
      }
    }

    // Apply other filters
    if (search && search.trim() !== '') {
      query.name = { $regex: search.trim(), $options: 'i' };
    }

    if (gender && gender !== 'All') {
      query.gender = gender;
    }

    if (minAge || maxAge) {
      query.age = {};
      if (minAge) query.age.$gte = Number(minAge);
      if (maxAge) query.age.$lte = Number(maxAge);
    }

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const skip = (page - 1) * limit;
    const sortOption = sort === 'name' ? { name: 1 } :
                       sort === 'age' ? { age: 1 } :
                       { createdAt: -1 };

    console.log('Final MongoDB query:', JSON.stringify(query, null, 2));

    const patients = await Patient.find(query)
      .skip(skip)
      .limit(Number(limit))
      .sort(sortOption)
      .lean();

    const total = await Patient.countDocuments(query);

    console.log('Found patients:', patients.length, 'Total:', total);

    res.json({
      patients,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching filtered patients:', error);
    res.status(500).json({ message: 'Server error while filtering patients' });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid Patient ID format' });
  }

  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patient details' });
  }
});

router.get('/:id/details', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate('visits')
      .populate('labReports');

    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    res.status(200).json({ patient });
  } catch (error) {
    console.error('Error fetching patient details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST clinical note and prescription to patient
router.post('/:id/add-note', async (req, res) => {
  const { doctorNote, medicines, duration, instructions, diagnosis } = req.body;

  try {
    const prescription = new Prescription({
      medicines,
      duration,
      instructions
    });
    await prescription.save();

    const visit = new Visit({
      patientId: req.params.id,
      visitDate: new Date(),
      doctorNote,
      diagnosis,
      prescriptionId: prescription._id
    });
    await visit.save();

    await Patient.findByIdAndUpdate(req.params.id, {
      $push: { visits: visit._id }
    });

    res.status(201).json({ message: 'Note and prescription added', visit });
  } catch (error) {
    console.error('Error adding note/prescription:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;