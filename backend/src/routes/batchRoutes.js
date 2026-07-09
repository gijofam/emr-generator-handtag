const express = require('express');
const batchController = require('../controllers/batchController');

const router = express.Router();

router.get('/', batchController.listBatches);
router.get('/:id', batchController.getBatch);
router.get('/:id/files', batchController.listFiles);
router.get('/:id/download/:fileName', batchController.downloadFile);

module.exports = router;
