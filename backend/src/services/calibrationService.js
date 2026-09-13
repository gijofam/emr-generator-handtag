const fs = require('fs');
const path = require('path');
const appConfig = require('../config/app');
const pdfService = require('./pdfService');
const qrService = require('./qrService');
const templateStore = require('../utils/templateStore');
const { mmToPoints } = require('../utils/printConfig');
const TEST_QR_URL = 'https://emr.pe/c/TEST-QR-001';

class CalibrationService {
  async getPreviewAssets() {
    const templatePath = templateStore.getActiveTemplatePath('front');
    if (!templatePath || !fs.existsSync(templatePath)) throw new Error('No hay plantilla frontal activa.');
    const template = fs.readFileSync(templatePath);
    const naturalSize = { width: template.readUInt32BE(16), height: template.readUInt32BE(20) };
    const drawRect = pdfService.resolveTemplateDrawRect({ x: 0, y: 0,
      width: mmToPoints(appConfig.printDefaults.handtagWidthMm),
      height: mmToPoints(appConfig.printDefaults.handtagHeightMm) }, naturalSize);
    const qrRect = pdfService.resolveQrRectWithinDrawRect(drawRect);
    const qrBuffer = await qrService.generateQrBuffer(TEST_QR_URL);
    return {
      qrDataUrl: 'data:image/png;base64,' + qrBuffer.toString('base64'),
      qrUrl: TEST_QR_URL,
      templateDataUrl: 'data:image/png;base64,' + template.toString('base64'),
      defaultQrPlacement: {
        x: (qrRect.x - drawRect.x) / mmToPoints(1),
        y: (qrRect.y - drawRect.y) / mmToPoints(1),
        width: qrRect.width / mmToPoints(1), height: qrRect.height / mmToPoints(1),
      },
      referenceSizeMm: { width: drawRect.width / mmToPoints(1), height: drawRect.height / mmToPoints(1) },
    };
  }

  async generatePreviewPdf(printConfig = {}) {
    const outputDir = path.join(appConfig.outputDir, 'test');
    const pdfFileName = 'preview.pdf';
    const qrRows = [[
      'TEST-QR-001',
      TEST_QR_URL,
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