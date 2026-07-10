const path = require('path');

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
    qrPlacement: {
      x: 20,
      y: 80,
      width: 35,
      height: 35,
    },
    templateFrontPath: process.env.HANDTAG_FRONT_TEMPLATE || '',
    templateBackPath: process.env.HANDTAG_BACK_TEMPLATE || '',
  },
};
