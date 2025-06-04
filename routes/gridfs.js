// utils/gridfs.js
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

let gfsBucket = null;

function initGridFS(connection) {
  if (!gfsBucket && connection && connection.db) {
    gfsBucket = new GridFSBucket(connection.db, {
      bucketName: 'fs'
    });
  }
  return gfsBucket;
}

function getGridFSBucket() {
  if (!gfsBucket) {
    throw new Error('GridFSBucket is not initialized!');
  }
  return gfsBucket;
}

module.exports = {
  initGridFS,
  getGridFSBucket
};


