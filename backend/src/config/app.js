const path = require('path');
const templateStore = require('../utils/templateStore');

module.exports = {
  outputDir: path.resolve(__dirname, '../../output'),
  qrBaseUrl: process.env.QR_BASE_URL || 'https://emr.pe/c',
  printDefaults: {
    handtagWidthMm: 160,
    handtagHeightMm: 65,
    bleedMm: 3,
    marginMm: 10,
    spacingMm: 3,
    paperSize: 'A4',
    paperWidthMm: 210,
    paperHeightMm: 297,
    imposition: true,
    qrPlacement: {
      x: 20,
      y: 18,
      width: 30,
      height: 30,
    },
    get templateFrontPath() {
      return templateStore.getActiveTemplatePath('front');
    },
    get templateBackPath() {
      return templateStore.getActiveTemplatePath('back');
    },
  },
};
