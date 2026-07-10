const QRCode = require('qrcode');

class QrService {
  async generateQrFile(qrPath, qrUrl, options = {}) {
    await QRCode.toFile(qrPath, qrUrl, { width: 240, margin: 1, ...options });
  }

  generateQrBuffer(qrUrl, options = {}) {
    return new Promise((resolve, reject) => {
      QRCode.toBuffer(qrUrl, { width: 260, margin: 1, ...options }, (err, buffer) => {
        if (err) {
          return reject(err);
        }
        resolve(buffer);
      });
    });
  }
}

module.exports = new QrService();
