const path = require('path');
const templateStore = require('../utils/templateStore');

module.exports = {
  outputDir: path.resolve(__dirname, '../../output'),
  qrBaseUrl: process.env.QR_BASE_URL || 'https://emr.pe/c',
  printDefaults: {
    handtagWidthMm: 65,
    handtagHeightMm: 140,
    bleedMm: 2,
    marginMm: 0,
    spacingMm: 1,
    paperSize: 'A4',
    paperWidthMm: 210,
    paperHeightMm: 297,
    imposition: true,
    qrPlacement: {
      x: 13,
      y: 74,
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
