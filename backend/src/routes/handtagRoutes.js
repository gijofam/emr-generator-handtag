const express = require('express');
const handtagController = require('../controllers/handtagController');

const router = express.Router();

router.get('/products', handtagController.listProducts);
router.post('/products', handtagController.createProduct);
router.post('/generate', handtagController.generateBatch);

module.exports = router;
