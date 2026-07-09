const QRCode = require('qrcode');
QRCode.toBuffer('https://emr.pe/c/test', { width: 260, margin: 1 }, (err, buf) => {
  if (err) {
    console.error('ERR', err);
    process.exit(1);
  }
  console.log('callback buffer', Buffer.isBuffer(buf), buf.length);
});
