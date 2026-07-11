const express = require('express');
const calibrationController = require('../controllers/calibrationController');

const router = express.Router();

router.post('/preview', calibrationController.previewPdf);

module.exports = router;