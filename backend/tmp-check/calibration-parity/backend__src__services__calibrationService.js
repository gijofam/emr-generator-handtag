const fs = require('fs');
const path = require('path');
const appConfig = require('../config/app');
const pdfService = require('./pdfService');

class CalibrationService {
  async generatePreviewPdf(printConfig = {}) {
    const outputDir = path.join(appConfig.outputDir, 'test');
    const pdfFileName = 'preview.pdf';
    const qrRows = [[
      'TEST-QR-001',
      `${appConfig.qrBaseUrl}/TEST-QR-001`,
    ]];

    fs.mkdirSync(outputDir, { recursive: true });
    console.log('[Preview] Iniciando render PDF');
    console.log('[Trace][calibrationService] qrPlacement recibido:', printConfig?.qrPlacement);
    const fileName = await pdfService.createPreviewPdf(outputDir, qrRows, {
      ...printConfig,
      // Preview must use the same visual sheet layout as production (A4 + imposition).
      imposition: true,
      paperSize: appConfig.printDefaults.paperSize,
      paperWidthMm: appConfig.printDefaults.paperWidthMm,
      paperHeightMm: appConfig.printDefaults.paperHeightMm,
      // Preserve source PNG orientation in preview rendering (no canvas rotation).
      preserveTemplateOrientation: true,
      // Preview-only slot behavior must match calibration physical reference.
      previewMode: true,
      // Enable strict QR preview diagnostics for calibration parity checks.
      debugPreviewQr: true,
      qrPlacement: printConfig?.qrPlacement ? { ...printConfig.qrPlacement } : undefined,
    }, pdfFileName);

    return {
      success: true,
      downloadUrl: `/output/test/${encodeURIComponent(fileName)}`,
      fileName,
    };
  }
}

module.exports = new CalibrationService();