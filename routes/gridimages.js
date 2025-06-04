const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

let gfsBucket = null;

function initGridFS(connection) {
  if (!gfsBucket && connection && connection.db) {
    gfsBucket = new GridFSBucket(connection.db, {
      bucketName: 'fs'
    });
    console.log("✅ GridFS initialized");
  }
}

function getGridFSBucket() {
  if (!gfsBucket) {
    throw new Error('GridFSBucket is not initialized!');
  }
  return gfsBucket;
}

router.get('/:id', async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const bucket = getGridFSBucket();

    const files = await bucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const file = files[0];
    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);

    const readStream = bucket.openDownloadStream(fileId);
    readStream.on('error', err => {
      res.status(500).json({ success: false, error: 'Error streaming file', details: err.message });
    });
    readStream.pipe(res);
  } catch (err) {
    res.status(400).json({ success: false, error: 'Invalid file id', details: err.message });
  }
});

// GET /api/files/meta/:id
router.get('/meta/:id', async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const bucket = getGridFSBucket();

    const files = await bucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const file = files[0];
    res.json({
      filename: file.filename,
      contentType: file.contentType,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Invalid file id', details: err.message });
  }
});


module.exports = {
  router,
  initGridFS
};
