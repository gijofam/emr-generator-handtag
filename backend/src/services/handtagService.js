const crypto = require('crypto');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const appConfig = require('../config/app');
const productRepository = require('../repositories/productRepository');
const handtagRepository = require('../repositories/handtagRepository');

class HandtagService {
  async createProduct({ name, prefix }) {
    const existingProduct = await productRepository.findByPrefix(prefix);
    if (existingProduct) {
      throw new Error('El prefijo ya está en uso.');
    }

    return productRepository.create({ name, prefix });
  }

  async listProducts() {
    return productRepository.listProducts();
  }

  async generateBatch({ productId, quantity, notes }) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new Error('Producto no encontrado.');
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('La cantidad debe ser un entero mayor a cero.');
    }

    const batch = await handtagRepository.createBatch(productId, quantity, notes);
    await handtagRepository.updateBatchStatus(batch.id, 'GENERATING');

    const codes = [];
    const csvRows = [];
    const outputDir = path.join(appConfig.outputDir, batch.id);
    fs.mkdirSync(outputDir, { recursive: true });

    for (let index = 0; index < quantity; index += 1) {
      const code = await this.createUniqueCode(product.prefix);
      const qrUrl = `${appConfig.qrBaseUrl}/${code}`;
      const qrPath = path.join(outputDir, `${code}.png`);
      await QRCode.toFile(qrPath, qrUrl, { width: 240, margin: 1 });

      codes.push({
        batchId: batch.id,
        productId,
        code,
        qrUrl,
        status: 'GENERATED',
      });

      csvRows.push([code, qrUrl]);
    }

    await handtagRepository.createCodes(codes);
    const pdfFileName = await this.createPdfBundle(outputDir, csvRows, product, batch.id);
    const csvFileName = `${product.prefix}_${batch.id}.csv`;
    await handtagRepository.updateBatchStatus(batch.id, 'COMPLETED', new Date());

    return {
      batchId: batch.id,
      productName: product.name,
      quantity,
      downloadFiles: [
        {
          name: pdfFileName,
          type: 'pdf',
          downloadUrl: `/api/batches/${batch.id}/download/${encodeURIComponent(pdfFileName)}`,
        },
        {
          name: csvFileName,
          type: 'csv',
          downloadUrl: `/api/batches/${batch.id}/download/${encodeURIComponent(csvFileName)}`,
        },
      ],
      codes: codes.map(({ code }) => ({
        code,
        qrUrl: `${appConfig.qrBaseUrl}/${code}`,
      })),
    };
  }

  async createUniqueCode(prefix) {
    const seen = new Set();
    while (true) {
      const candidate = this.makeCode(prefix);
      if (seen.has(candidate)) {
        continue;
      }
      seen.add(candidate);
      const exists = await handtagRepository.codeExists(candidate);
      if (!exists) {
        return candidate;
      }
    }
  }

  makeCode(prefix) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const segment = [];
    for (let i = 0; i < 6; i += 1) {
      const set = i % 2 === 0 ? letters : numbers;
      segment.push(set[Math.floor(Math.random() * set.length)]);
    }
    return `${prefix}-${segment.join('')}`;
  }

  async createPdfBundle(outputDir, csvRows, product, batchId) {
    const fileName = `${product.prefix}_${batchId}`;
    const pdfPath = path.join(outputDir, `${fileName}.pdf`);
    const csvPath = path.join(outputDir, `${fileName}.csv`);
    const csvContent = ['code,qrUrl', ...csvRows.map(([code, qrUrl]) => `${code},${qrUrl}`)].join('\n');
    fs.writeFileSync(csvPath, csvContent, 'utf8');

    const pageSize = [186, 455];
    const doc = new PDFDocument({ size: pageSize, margin: 18 });
    doc.pipe(fs.createWriteStream(pdfPath));

    for (let index = 0; index < csvRows.length; index += 1) {
      const [code, qrUrl] = csvRows[index];
      if (index > 0) {
        doc.addPage({ size: pageSize, margin: 18 });
      }
      await this.drawFrontPage(doc, code, qrUrl);
      doc.addPage({ size: pageSize, margin: 18 });
      this.drawBackPage(doc, code);
    }

    doc.end();
    return `${fileName}.pdf`;
  }

  async drawFrontPage(doc, code, qrUrl) {
    doc.fillColor('#000000');
    doc.fontSize(14).font('Helvetica-Bold').text('EMR', { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica').text('ACTIVA TU CÓDIGO EMR', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).text('Esta prenda guarda tres momentos', { align: 'center' });
    doc.text('para recordar quién estás decidido', { align: 'center' });
    doc.text('a ser.', { align: 'center' });
    doc.moveDown(0.6);

    const qrImageBuffer = await this.generateQrBuffer(qrUrl);
    doc.image(qrImageBuffer, (doc.page.width - 130) / 2, doc.y, { width: 130, height: 130 });
    doc.moveDown(7);
    doc.fontSize(10).font('Helvetica-Bold').text(code, { align: 'center' });
    doc.moveDown(0.6);
    doc.fontSize(8).font('Helvetica').text('No compraste una prenda.', { align: 'center' });
    doc.text('Comenzaste un camino.', { align: 'center' });
  }

  generateQrBuffer(qrUrl) {
    return new Promise((resolve, reject) => {
      QRCode.toBuffer(qrUrl, { width: 260, margin: 1 }, (err, buffer) => {
        if (err) {
          return reject(err);
        }
        resolve(buffer);
      });
    });
  }

  drawBackPage(doc, code) {
    doc.fillColor('#000000');
    doc.fontSize(14).font('Helvetica-Bold').text('BIENVENIDO A EMR', { align: 'center' });
    doc.moveDown(0.8);
    doc.fontSize(8).font('Helvetica').text('Hay prendas que solo se usan.', { align: 'center' });
    doc.text('Esta fue creada para recordarte', { align: 'center' });
    doc.text('quién puedes llegar a ser.', { align: 'center' });
    doc.moveDown(0.8);
    doc.text('Tu Código EMR desbloqueará tres mensajes exclusivos', { align: 'center' });
    doc.text('para acompañarte en tu camino.', { align: 'center' });
    doc.moveDown(0.4);
    doc.text('Léelo.', { align: 'center' });
    doc.text('Guárdalo.', { align: 'center' });
    doc.text('Compártelo.', { align: 'center' });
    doc.moveDown(0.8);
    doc.text('Pero, sobre todo...', { align: 'center' });
    doc.font('Helvetica-Bold').text('Vívelo.', { align: 'center' });
    doc.moveDown(1);

    const iconY = doc.y;
    const centerX = doc.page.width / 2;
    const iconWidth = 20;
    const spacing = 18;
    const icons = ['IG', 'TT', 'FB'];
    icons.forEach((label, idx) => {
      const x = centerX - ((icons.length - 1) * (iconWidth + spacing)) / 2 + idx * (iconWidth + spacing);
      doc.rect(x, iconY, iconWidth, iconWidth).stroke();
      doc.fontSize(6).text(label, x, iconY + 6, { width: iconWidth, align: 'center' });
    });
    doc.moveDown(3.5);
    doc.fontSize(10).font('Helvetica-Bold').text('EMR', { align: 'center' });
  }

}

module.exports = new HandtagService();
