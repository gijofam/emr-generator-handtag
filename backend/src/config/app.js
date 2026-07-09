const path = require('path');

module.exports = {
  outputDir: path.resolve(__dirname, '../../output'),
  qrBaseUrl: process.env.QR_BASE_URL || 'https://emr.pe/c',
};
