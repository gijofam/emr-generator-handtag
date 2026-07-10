const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const qrService = require('./qrService');
const appConfig = require('../config/app');
const { normalizePrintConfig, mmToPoints, getPaperSize } = require('../utils/printConfig');

class PdfService {
  async createPdfBundle(outputDir, csvRows, product, batchId, printConfig = {}) {
    const fileName = `${product.prefix}_${batchId}`;
    const pdfPath = path.join(outputDir, `${fileName}.pdf`);
    const csvPath = path.join(outputDir, `${fileName}.csv`);
    const csvContent = ['code,qrUrl', ...csvRows.map(([code, qrUrl]) => `${code},${qrUrl}`)].join('\n');
    fs.writeFileSync(csvPath, csvContent, 'utf8');

    const finalConfig = this.resolvePrintConfig(printConfig);
    const paperSize = getPaperSize(finalConfig.paperSize, {
      width: finalConfig.paperWidthMm,
      height: finalConfig.paperHeightMm,
    });
    const pageSize = [mmToPoints(paperSize.width), mmToPoints(paperSize.height)];
    const doc = new PDFDocument({ size: pageSize, margin: 0 });
    doc.pipe(fs.createWriteStream(pdfPath));

    for (let index = 0; index < csvRows.length; index += 1) {
      const [code, qrUrl] = csvRows[index];
      if (index > 0) {
        doc.addPage({ size: pageSize, margin: 0 });
      }
      await this.drawFrontPage(doc, code, qrUrl, finalConfig);
      doc.addPage({ size: pageSize, margin: 0 });
      this.drawBackPage(doc, code, finalConfig);
    }

    doc.end();
    return `${fileName}.pdf`;
  }

  resolvePrintConfig(printConfig = {}) {
    return normalizePrintConfig({
      ...appConfig.printDefaults,
      ...printConfig,
      qrPlacement: {
        ...(appConfig.printDefaults.qrPlacement || {}),
        ...(printConfig?.qrPlacement || {}),
      },
    });
  }

  async drawFrontPage(doc, code, qrUrl, printConfig) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const qrPlacement = printConfig.qrPlacement || {};
    const qrX = mmToPoints(qrPlacement.x || 0);
    const qrY = mmToPoints(qrPlacement.y || 0);
    const qrWidth = mmToPoints(qrPlacement.width || 35);
    const qrHeight = mmToPoints(qrPlacement.height || 35);

    if (printConfig.templateFrontPath) {
      try {
        const imageBuffer = fs.readFileSync(printConfig.templateFrontPath);
        doc.image(imageBuffer, 0, 0, { width: pageWidth, height: pageHeight });
      } catch (_error) {
        // fall back to the default text layout when the template is unavailable
      }
    }

    if (!printConfig.templateFrontPath) {
      doc.fillColor('#000000');
      doc.fontSize(14).font('Helvetica-Bold').text('EMR', { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(10).font('Helvetica').text('ACTIVA TU CÓDIGO EMR', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(8).text('Esta prenda guarda tres momentos', { align: 'center' });
      doc.text('para recordar quién estás decidido', { align: 'center' });
      doc.text('a ser.', { align: 'center' });
      doc.moveDown(0.6);
    }

    const qrImageBuffer = await qrService.generateQrBuffer(qrUrl);
    doc.image(qrImageBuffer, qrX, qrY, { width: qrWidth, height: qrHeight });

    if (!printConfig.templateFrontPath) {
      doc.moveDown(7);
      doc.fontSize(10).font('Helvetica-Bold').text(code, { align: 'center' });
      doc.moveDown(0.6);
      doc.fontSize(8).font('Helvetica').text('No compraste una prenda.', { align: 'center' });
      doc.text('Comenzaste un camino.', { align: 'center' });
    }
  }

  drawBackPage(doc, code, printConfig) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    if (printConfig.templateBackPath) {
      try {
        const imageBuffer = fs.readFileSync(printConfig.templateBackPath);
        doc.image(imageBuffer, 0, 0, { width: pageWidth, height: pageHeight });
      } catch (_error) {
        // fall back to the default text layout when the template is unavailable
      }
    }

    if (!printConfig.templateBackPath) {
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
}

module.exports = new PdfService();
