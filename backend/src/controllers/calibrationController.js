const calibrationService = require('../services/calibrationService');

class CalibrationController {
  async previewPdf(req, res, next) {
    try {
      console.log('[Preview] Endpoint ejecutado');
      console.log('[Trace][calibrationController] body recibido:', req.body);
      const incomingPrintConfig = req.body?.printConfig || {};
      const result = await calibrationService.generatePreviewPdf(incomingPrintConfig);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CalibrationController();