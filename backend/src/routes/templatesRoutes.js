const express = require('express');
const templatesController = require('../controllers/templatesController');

const router = express.Router();

router.get('/', templatesController.getTemplateInfo);
router.get('/front/active', templatesController.getActiveFrontTemplate);
router.put('/', templatesController.updateTemplates);

module.exports = router;
