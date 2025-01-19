const express = require('express');
const router = express.Router();
const Application = require('../models/Application');
const scannerService = require('../services/scannerService');
const scraperService = require('../services/scraperService');
const VersionUtil = require('../utils/versionUtil');

// Get all applications
router.get('/', async (req, res) => {
  try {
    const applications = await Application.find();
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add new application
router.post('/', async (req, res) => {
  try {
    const { filePath } = req.body;
    const applicationInfo = await scannerService.scanApplication(filePath);
    
    const application = new Application(applicationInfo);
    const savedApplication = await application.save();
    
    // Check for updates immediately after adding
    const updateInfo = await scraperService.checkForUpdates(savedApplication);
    savedApplication.updateAvailable = updateInfo.hasUpdate;
    savedApplication.latestVersion = updateInfo.latestVersion;
    savedApplication.updateUrl = updateInfo.downloadUrl;
    await savedApplication.save();
    
    res.status(201).json(savedApplication);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Check for updates
router.get('/:id/check-updates', async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const updateInfo = await scraperService.checkForUpdates(application);
    
    // Update the application with latest version info
    application.updateAvailable = updateInfo.hasUpdate;
    application.latestVersion = updateInfo.latestVersion;
    application.updateUrl = updateInfo.downloadUrl;
    application.lastChecked = new Date();
    await application.save();

    res.json(updateInfo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove application
router.delete('/:id', async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    await application.remove();
    res.json({ message: 'Application removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update application metadata
router.patch('/:id', async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    Object.assign(application, req.body);
    const updatedApplication = await application.save();
    res.json(updatedApplication);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
