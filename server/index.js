const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const applicationRoutes = require('./routes/applications');
const scannerService = require('./services/scannerService');
const scraperService = require('./services/scraperService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/software-update-manager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Routes
app.use('/api/applications', applicationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
