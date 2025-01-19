const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  path: {
    type: String,
    required: true,
    unique: true
  },
  version: {
    type: String,
    required: true,
    default: '0.0.0'
  },
  publisher: {
    type: String,
    required: true,
    default: 'Unknown'
  },
  icon: {
    type: String,
    default: null
  },
  lastChecked: {
    type: Date,
    default: Date.now
  },
  latestVersion: {
    type: String,
    default: null
  },
  metadata: {
    fileSize: Number,
    created: Date,
    modified: Date,
    description: String,
    copyright: String,
    productVersion: String,
    originalFilename: String,
    internalName: String,
    productName: String,
    companyName: String,
    language: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Application', ApplicationSchema);