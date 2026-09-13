const calibrationService = require('../services/calibrationService');

class CalibrationController {
  async previewPdf(req, res, next) {
    try {
      // Reuse the existing preview endpoint without adding or changing routes.
      if (req.body?.format === 'assets') {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json(await calibrationService.getPreviewAssets());
      }
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