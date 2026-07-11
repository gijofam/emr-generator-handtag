const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const qrService = require('./qrService');
const appConfig = require('../config/app');
const { normalizePrintConfig, mmToPoints, getPaperSize, resolveTemplatePath } = require('../utils/printConfig');
const { calculateLayout } = require('../utils/printLayout');
const templateStore = require('../utils/templateStore');

class PdfService {
  async createPreviewPdf(outputDir, qrRows, printConfig = {}, pdfFileName = 'preview.pdf') {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log('[Trace][pdfService.createPreviewPdf] qrPlacement recibido:', printConfig?.qrPlacement);

    const finalConfig = this.resolvePrintConfig(printConfig);
    if (printConfig?.qrPlacement) {
      finalConfig.qrPlacement = {
        x: Number(printConfig.qrPlacement.x),
        y: Number(printConfig.qrPlacement.y),
        width: Number(printConfig.qrPlacement.width),
        height: Number(printConfig.qrPlacement.height),
      };
    }

    const paperSize = getPaperSize(finalConfig.paperSize, {
      width: finalConfig.paperWidthMm,
      height: finalConfig.paperHeightMm,
    });
    const pageSize = [mmToPoints(paperSize.width), mmToPoints(paperSize.height)];
    const pdfPath = path.join(outputDir, pdfFileName);
    const doc = new PDFDocument({ size: pageSize, margin: 0, autoFirstPage: false });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    try {
      if (finalConfig.imposition) {
        await this.drawImposedPdf(doc, qrRows, finalConfig, paperSize);
      } else {
        await this.drawIndividualPdf(doc, qrRows, finalConfig, pageSize);
      }

      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        doc.end();
      });

      return pdfFileName;
    } catch (error) {
      writeStream.destroy();
      throw error;
    }
  }

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
    const doc = new PDFDocument({ size: pageSize, margin: 0, autoFirstPage: false });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    try {
      if (finalConfig.imposition) {
        await this.drawImposedPdf(doc, csvRows, finalConfig, paperSize);
      } else {
        await this.drawIndividualPdf(doc, csvRows, finalConfig, pageSize);
      }

      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        doc.end();
      });

      return `${fileName}.pdf`;
    } catch (error) {
      writeStream.destroy();
      throw error;
    }
  }

  resolvePrintConfig(printConfig = {}) {
    const resolved = normalizePrintConfig({
      ...appConfig.printDefaults,
      ...printConfig,
      qrPlacement: {
        ...(appConfig.printDefaults.qrPlacement || {}),
        ...(printConfig?.qrPlacement || {}),
      },
      margins: {
        ...(appConfig.printDefaults.margins || {}),
        ...(printConfig?.margins || {}),
      },
    });

    resolved.preserveTemplateOrientation = Boolean(printConfig?.preserveTemplateOrientation);
    resolved.debugPreviewQr = Boolean(printConfig?.debugPreviewQr);

    // If template paths are not explicitly provided in payload/config,
    // always use the currently active templates stored by the system.
    if (!resolved.templateFrontPath) {
      resolved.templateFrontPath = templateStore.getActiveTemplatePath('front');
    }
    if (!resolved.templateBackPath) {
      resolved.templateBackPath = templateStore.getActiveTemplatePath('back');
    }

    return resolved;
  }

  async drawIndividualPdf(doc, csvRows, printConfig, pageSize) {
    const [pageWidth, pageHeight] = pageSize;
    for (let index = 0; index < csvRows.length; index += 1) {
      const [code, qrUrl] = csvRows[index];
      doc.addPage({ size: pageSize, margin: 0 });
      await this.drawHandtagPage(doc, { side: 'front', code, qrUrl, printConfig, x: 0, y: 0, width: pageWidth, height: pageHeight });
      doc.addPage({ size: pageSize, margin: 0 });
      await this.drawHandtagPage(doc, { side: 'back', code, qrUrl: null, printConfig, x: 0, y: 0, width: pageWidth, height: pageHeight });
    }
  }

  async drawImposedPdf(doc, csvRows, printConfig, paperSize) {
    const layout = calculateLayout({
      paperSize,
      margins: printConfig.margins,
      spacing: printConfig.spacingMm,
      bleed: printConfig.bleedMm,
      handtagWidth: printConfig.handtagWidthMm,
      handtagHeight: printConfig.handtagHeightMm,
      handtagCount: csvRows.length,
    });

    const sheetCapacity = layout.columns * layout.rows;
    for (let offset = 0; offset < csvRows.length; offset += sheetCapacity) {
      const sheetEntries = csvRows.slice(offset, offset + sheetCapacity);
      doc.addPage({ size: [layout.pageWidthPt, layout.pageHeightPt], margin: 0 });
      await this.drawImposedPage(doc, sheetEntries, printConfig, layout, 'front');
      doc.addPage({ size: [layout.pageWidthPt, layout.pageHeightPt], margin: 0 });
      await this.drawImposedPage(doc, sheetEntries, printConfig, layout, 'back');
    }
  }

  async drawImposedPage(doc, entries, printConfig, layout, side) {
    let index = 0;
    for (let row = 0; row < layout.rows; row += 1) {
      for (let column = 0; column < layout.columns; column += 1) {
        if (index >= entries.length) {
          break;
        }

        const [code, qrUrl] = entries[index];
        const x = layout.startXPt + (column * (layout.handtagWidthPt + mmToPoints(printConfig.spacingMm)));
        const y = layout.startYPt + (row * (layout.handtagHeightPt + mmToPoints(printConfig.spacingMm)));
        await this.drawHandtagPage(doc, {
          side,
          code,
          qrUrl: side === 'front' ? qrUrl : null,
          printConfig,
          x,
          y,
          width: layout.handtagWidthPt,
          height: layout.handtagHeightPt,
        });
        index += 1;
      }
    }
  }

  async drawHandtagPage(doc, { side, code, qrUrl, printConfig, x, y, width, height }) {
    const templatePath = side === 'front' ? printConfig.templateFrontPath : printConfig.templateBackPath;
    const resolvedTemplatePath = resolveTemplatePath(templatePath);
    const templateBuffer = resolvedTemplatePath && fs.existsSync(resolvedTemplatePath) ? fs.readFileSync(resolvedTemplatePath) : null;
    const templateImageMeta = this.getTemplateImageMeta(doc, templateBuffer);

    const preserveTemplateOrientation = Boolean(printConfig?.preserveTemplateOrientation);
    const useVerticalRotation = !preserveTemplateOrientation;

    doc.save();
    if (useVerticalRotation) {
      doc.translate(x, y + height);
      doc.rotate(-90);
    } else {
      doc.translate(x, y);
    }

    const localWidth = useVerticalRotation ? height : width;
    const localHeight = useVerticalRotation ? width : height;
    const templateSlotRect = { x: 0, y: 0, width: localWidth, height: localHeight };
    const drawRect = preserveTemplateOrientation
      ? this.resolveTemplateDrawRect(templateSlotRect, templateImageMeta)
      : templateSlotRect;
    const pngRenderRect = {
      x: drawRect.x,
      y: drawRect.y,
      width: drawRect.width,
      height: drawRect.height,
    };

    if (templateBuffer) {
      doc.image(templateBuffer, drawRect.x, drawRect.y, { width: drawRect.width, height: drawRect.height });
    } else {
      this.drawFallbackTemplate(doc, side, drawRect.x, drawRect.y, drawRect.width, drawRect.height, code);
    }

    if (side === 'front' && printConfig?.debugPreviewQr) {
      console.log('Template drawRect:');
      console.log(`x: ${drawRect.x}`);
      console.log(`y: ${drawRect.y}`);
      console.log(`width: ${drawRect.width}`);
      console.log(`height: ${drawRect.height}`);
      console.log('pngRenderRect:');
      console.log(`x: ${pngRenderRect.x}`);
      console.log(`y: ${pngRenderRect.y}`);
      console.log(`width: ${pngRenderRect.width}`);
      console.log(`height: ${pngRenderRect.height}`);
      console.log('Template image options:');
      console.log(`width: ${drawRect.width}`);
      console.log(`height: ${drawRect.height}`);
      console.log('fit: undefined');
      console.log('cover: undefined');
      console.log('contain: undefined');
      console.log('align: undefined');
      console.log('valign: undefined');
      console.log('preserveAspectRatio: undefined');

      const visiblePngOriginX = useVerticalRotation ? drawRect.x : (x + drawRect.x);
      const visiblePngOriginY = useVerticalRotation ? drawRect.y : (y + drawRect.y);
      console.log('Template visible PNG origin (points):');
      console.log(`x: ${visiblePngOriginX}`);
      console.log(`y: ${visiblePngOriginY}`);
    }

    if (side === 'front' && qrUrl) {
      const qrImageBuffer = await qrService.generateQrBuffer(qrUrl);

      if (preserveTemplateOrientation) {
        const qrRect = this.resolveQrRectWithinDrawRect(drawRect, printConfig, templateImageMeta);
        this.assertSameDrawRect(drawRect, qrRect.drawRect);
        if (printConfig?.debugPreviewQr) {
          const qrPlacement = printConfig.qrPlacement || {};
          const mmWidth = Number(qrPlacement.width);
          const mmHeight = Number(qrPlacement.height);
          const scaleX = Number.isFinite(mmWidth) && mmWidth !== 0 ? (qrRect.width / mmWidth) : 0;
          const scaleY = Number.isFinite(mmHeight) && mmHeight !== 0 ? (qrRect.height / mmHeight) : 0;

          console.log('QR (mm):');
          console.log(`x: ${Number(qrPlacement.x)}`);
          console.log(`y: ${Number(qrPlacement.y)}`);
          console.log(`width: ${mmWidth}`);
          console.log(`height: ${mmHeight}`);
          console.log('QR (points):');
          console.log(`x: ${qrRect.x}`);
          console.log(`y: ${qrRect.y}`);
          console.log(`width: ${qrRect.width}`);
          console.log(`height: ${qrRect.height}`);
          console.log('qrRect calculado:');
          console.log(`x: ${qrRect.x}`);
          console.log(`y: ${qrRect.y}`);
          console.log(`width: ${qrRect.width}`);
          console.log(`height: ${qrRect.height}`);

          const expectedQrX = drawRect.x + mmToPoints(Number(qrPlacement.x));
          const expectedQrY = drawRect.y + mmToPoints(Number(qrPlacement.y));
          const offsetXPt = qrRect.x - expectedQrX;
          const offsetYPt = qrRect.y - expectedQrY;
          console.log(`qrX formula exacta (drawRect.x + mmToPoints(qrPlacement.x)): ${expectedQrX}`);
          console.log(`qrY formula exacta (drawRect.y + mmToPoints(qrPlacement.y)): ${expectedQrY}`);
          console.log(`qrOffsetX(pt): ${offsetXPt}`);
          console.log(`qrOffsetY(pt): ${offsetYPt}`);
          console.log(`qrOffsetX(mm): ${offsetXPt / 2.83464567}`);
          console.log(`qrOffsetY(mm): ${offsetYPt / 2.83464567}`);
          console.log('QR reference rect source: drawRect');
          console.log(`scaleX: ${scaleX}`);
          console.log(`scaleY: ${scaleY}`);
        }
        doc.image(qrImageBuffer, qrRect.x, qrRect.y, { width: qrRect.width, height: qrRect.height });
      } else {
        const qrPlacement = printConfig.qrPlacement || {};
        const qrX = mmToPoints(Number(qrPlacement.x));
        const qrY = mmToPoints(Number(qrPlacement.y));
        const qrWidth = mmToPoints(Number(qrPlacement.width));
        const qrHeight = mmToPoints(Number(qrPlacement.height));
        if (printConfig?.debugPreviewQr) {
          const mmWidth = Number(qrPlacement.width);
          const mmHeight = Number(qrPlacement.height);
          const scaleX = Number.isFinite(mmWidth) && mmWidth !== 0 ? (qrWidth / mmWidth) : 0;
          const scaleY = Number.isFinite(mmHeight) && mmHeight !== 0 ? (qrHeight / mmHeight) : 0;

          console.log('QR (mm):');
          console.log(`x: ${Number(qrPlacement.x)}`);
          console.log(`y: ${Number(qrPlacement.y)}`);
          console.log(`width: ${mmWidth}`);
          console.log(`height: ${mmHeight}`);
          console.log('QR (points):');
          console.log(`x: ${qrX}`);
          console.log(`y: ${qrY}`);
          console.log(`width: ${qrWidth}`);
          console.log(`height: ${qrHeight}`);
          console.log(`scaleX: ${scaleX}`);
          console.log(`scaleY: ${scaleY}`);
        }
        doc.image(qrImageBuffer, qrX, qrY, { width: qrWidth, height: qrHeight });
      }
    }

    doc.restore();
  }

  getTemplateImageMeta(doc, templateBuffer) {
    if (!templateBuffer) {
      return null;
    }

    try {
      const image = doc.openImage(templateBuffer);
      const imageWidth = Number(image?.width);
      const imageHeight = Number(image?.height);
      if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
        return null;
      }
      return { width: imageWidth, height: imageHeight };
    } catch (_error) {
      return null;
    }
  }

  resolveTemplateDrawRect(slotRect, templateImageMeta) {
    if (!templateImageMeta) {
      return slotRect;
    }

    const slotAspect = slotRect.width / slotRect.height;
    const imageAspect = templateImageMeta.width / templateImageMeta.height;

    if (!Number.isFinite(slotAspect) || !Number.isFinite(imageAspect) || slotAspect <= 0 || imageAspect <= 0) {
      return slotRect;
    }

    if (imageAspect > slotAspect) {
      const fittedHeight = slotRect.width / imageAspect;
      return {
        x: slotRect.x,
        y: slotRect.y + ((slotRect.height - fittedHeight) / 2),
        width: slotRect.width,
        height: fittedHeight,
      };
    }

    const fittedWidth = slotRect.height * imageAspect;
    return {
      x: slotRect.x + ((slotRect.width - fittedWidth) / 2),
      y: slotRect.y,
      width: fittedWidth,
      height: slotRect.height,
    };
  }

  resolveQrRectWithinDrawRect(drawRect, printConfig, templateImageMeta) {
    const qrPlacement = printConfig.qrPlacement || {};
    const qrX = drawRect.x + mmToPoints(Number(qrPlacement.x));
    const qrY = drawRect.y + mmToPoints(Number(qrPlacement.y));
    const qrWidth = mmToPoints(Number(qrPlacement.width));
    const qrHeight = mmToPoints(Number(qrPlacement.height));

    return {
      drawRect,
      x: qrX,
      y: qrY,
      width: qrWidth,
      height: qrHeight,
    };
  }

  resolveCalibrationSpaceMm(printConfig, templateImageMeta) {
    const configuredWidth = Number(printConfig?.handtagWidthMm) || Number(appConfig.printDefaults.handtagWidthMm);
    const configuredHeight = Number(printConfig?.handtagHeightMm) || Number(appConfig.printDefaults.handtagHeightMm);

    if (!templateImageMeta) {
      return { width: configuredWidth, height: configuredHeight };
    }

    const longSide = Math.max(configuredWidth, configuredHeight);
    const shortSide = Math.min(configuredWidth, configuredHeight);
    const isImageLandscape = templateImageMeta.width >= templateImageMeta.height;

    return isImageLandscape
      ? { width: longSide, height: shortSide }
      : { width: shortSide, height: longSide };
  }

  assertSameDrawRect(templateDrawRect, qrDrawRect) {
    if (
      templateDrawRect.x !== qrDrawRect.x
      || templateDrawRect.y !== qrDrawRect.y
      || templateDrawRect.width !== qrDrawRect.width
      || templateDrawRect.height !== qrDrawRect.height
    ) {
      throw new Error('Template and QR must share the exact same drawRect reference values.');
    }
  }

  drawFallbackTemplate(doc, side, x, y, width, height, code) {
    doc.save();
    doc.rect(x, y, width, height).stroke('#000000');
    doc.fillColor('#111111');
    doc.fontSize(10).font('Helvetica-Bold').text(side === 'front' ? 'FRONT' : 'BACK', x + 10, y + 10, { width: width - 20 });
    doc.fontSize(8).font('Helvetica').text(code, x + 10, y + 30, { width: width - 20 });
    doc.restore();
  }
}

module.exports = new PdfService();
