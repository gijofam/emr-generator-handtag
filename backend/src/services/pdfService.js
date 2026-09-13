const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const qrService = require('./qrService');
const appConfig = require('../config/app');
const { normalizePrintConfig, mmToPoints, getPaperSize, resolveTemplatePath } = require('../utils/printConfig');
const { calculateLayout } = require('../utils/printLayout');
const templateStore = require('../utils/templateStore');

class PdfService {
  getCtmSnapshot(doc) {
    const ctm = doc?._ctm;
    if (!ctm) {
      return null;
    }

    return {
      a: ctm.a,
      b: ctm.b,
      c: ctm.c,
      d: ctm.d,
      e: ctm.e,
      f: ctm.f,
    };
  }

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
      if (finalConfig.previewMode) {
        await this.drawCalibrationPreviewPdf(doc, qrRows, finalConfig, paperSize);
      } else if (finalConfig.imposition) {
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

    resolved.qrPlacementNormalized = printConfig?.qrPlacementNormalized || null;
    resolved.preserveTemplateOrientation = Boolean(printConfig?.preserveTemplateOrientation);
    resolved.previewMode = Boolean(printConfig?.previewMode);
    resolved.debugPreviewQr = Boolean(printConfig?.debugPreviewQr);
    resolved.previewOffsetMm = {
      x: Number(printConfig?.previewOffsetMm?.x) || 0,
      y: Number(printConfig?.previewOffsetMm?.y) || 0,
    };

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

  resolvePreviewSlotSize(width, height, templateImageMeta, printConfig) {
    if (!printConfig?.previewMode || !templateImageMeta) {
      return { width, height };
    }

    const isTemplateLandscape = templateImageMeta.width >= templateImageMeta.height;
    const isSlotLandscape = width >= height;

    if (isTemplateLandscape === isSlotLandscape) {
      return { width, height };
    }

    return { width: height, height: width };
  }

  resolveLocalHandtagSize(printConfig, templateImageMeta) {
    const handtagWidthMm = Number(printConfig?.handtagWidthMm) || Number(appConfig.printDefaults.handtagWidthMm);
    const handtagHeightMm = Number(printConfig?.handtagHeightMm) || Number(appConfig.printDefaults.handtagHeightMm);
    const bleedMm = Number(printConfig?.bleedMm) || Number(appConfig.printDefaults.bleedMm);
    const effectiveWidthMm = handtagWidthMm + (bleedMm * 2);
    const effectiveHeightMm = handtagHeightMm + (bleedMm * 2);

    if (!templateImageMeta) {
      return {
        width: mmToPoints(effectiveWidthMm),
        height: mmToPoints(effectiveHeightMm),
      };
    }

    return {
      width: mmToPoints(effectiveWidthMm),
      height: mmToPoints(effectiveHeightMm),
    };
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

  async drawCalibrationPreviewPdf(doc, rows, printConfig, paperSize) {
    const pageSize = [mmToPoints(paperSize.width), mmToPoints(paperSize.height)];
    const blockWidthPt = mmToPoints(Number(printConfig.handtagWidthMm));
    const blockHeightPt = mmToPoints(Number(printConfig.handtagHeightMm));
    const originXPt = mmToPoints(Number(printConfig?.previewOffsetMm?.x) || 0);
    const originYPt = mmToPoints(Number(printConfig?.previewOffsetMm?.y) || 0);

    for (let index = 0; index < rows.length; index += 1) {
      const [code, qrUrl] = rows[index];

      // Render preview in the same local handtag coordinate system as calibration.
      // Page-level placement is applied once at block origin (0,0).
      doc.addPage({ size: pageSize, margin: 0 });
      await this.drawHandtagPage(doc, {
        side: 'front',
        code,
        qrUrl,
        printConfig,
        x: originXPt,
        y: originYPt,
        width: blockWidthPt,
        height: blockHeightPt,
      });

      doc.addPage({ size: pageSize, margin: 0 });
      await this.drawHandtagPage(doc, {
        side: 'back',
        code,
        qrUrl: null,
        printConfig,
        x: originXPt,
        y: originYPt,
        width: blockWidthPt,
        height: blockHeightPt,
      });
    }
  }

  async drawImposedPdf(doc, csvRows, printConfig, paperSize) {
    const previewBleedMm = printConfig?.previewMode ? 0 : printConfig.bleedMm;
    const layout = calculateLayout({
      paperSize,
      margins: printConfig.margins,
      spacing: printConfig.spacingMm,
      bleed: previewBleedMm,
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
    const spacingPt = mmToPoints(layout.spacing);
    const slotStepX = layout.handtagWidthPt + spacingPt;
    const slotStepY = layout.handtagHeightPt + spacingPt;
    for (let row = 0; row < layout.rows; row += 1) {
      for (let column = 0; column < layout.columns; column += 1) {
        if (index >= entries.length) {
          break;
        }

        const [code, qrUrl] = entries[index];
        const x = layout.startXPt + (column * slotStepX);
        const y = layout.startYPt + (row * slotStepY);
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

    // Imposition already includes bleed in width/height. Do not inset it again.
    const templateSlotRect = { x: 0, y: 0, width, height };

    const ctmBeforeSave = this.getCtmSnapshot(doc);
    if (side === 'front' && printConfig?.debugPreviewQr) {
      console.log('[QR Trace] CTM before save():', ctmBeforeSave);
    }
    doc.save();
    const ctmAfterSave = this.getCtmSnapshot(doc);
    if (side === 'front' && printConfig?.debugPreviewQr) {
      console.log('[QR Trace] CTM after save():', ctmAfterSave);
    }
    if (side === 'front' && printConfig?.debugPreviewQr) {
      console.log('[QR Trace] CTM before translate(x, y):', this.getCtmSnapshot(doc));
    }
    doc.translate(x, y);
    if (side === 'front' && printConfig?.debugPreviewQr) {
      console.log('[QR Trace] CTM after translate(x, y):', this.getCtmSnapshot(doc));
    }

    const drawRect = this.resolveTemplateDrawRect(templateSlotRect, templateImageMeta, Boolean(printConfig.previewMode));
    const pngRenderRect = {
      x: drawRect.x,
      y: drawRect.y,
      width: drawRect.width,
      height: drawRect.height,
    };

    if (templateBuffer) {
      if (side === 'front' && printConfig?.debugPreviewQr) {
        console.log('[QR Trace] Template doc.image args:', {
          image: 'templateBuffer',
          x: drawRect.x,
          y: drawRect.y,
          options: { width: drawRect.width, height: drawRect.height },
          ctm: this.getCtmSnapshot(doc),
        });
      }
      doc.image(templateBuffer, drawRect.x, drawRect.y, { width: drawRect.width, height: drawRect.height });
    } else {
      this.drawFallbackTemplate(doc, side, drawRect.x, drawRect.y, drawRect.width, drawRect.height, code);
    }

    const ctmAfterTemplateRender = this.getCtmSnapshot(doc);

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

      const visiblePngOriginX = x + drawRect.x;
      const visiblePngOriginY = y + drawRect.y;
      console.log('Template visible PNG origin (points):');
      console.log(`x: ${visiblePngOriginX}`);
      console.log(`y: ${visiblePngOriginY}`);
    }

    if (side === 'front' && qrUrl) {
      const qrImageBuffer = await qrService.generateQrBuffer(qrUrl);
      const qrRect = this.resolveQrRectWithinDrawRect(drawRect, printConfig.qrPlacementNormalized);
      if (printConfig?.debugPreviewQr) {
        console.log('[QR Trace] Frame interior (points):', qrRect.frame);
        console.log('[QR Trace] Inner padding (points):', qrRect.padding);
        console.log('[QR Trace] Centered square QR (points):', {
          x: qrRect.x, y: qrRect.y, width: qrRect.width, height: qrRect.height,
        });
        console.log('[QR Trace] Same graphics context as template render:', JSON.stringify(this.getCtmSnapshot(doc)) === JSON.stringify(ctmAfterTemplateRender));
      }
      doc.image(qrImageBuffer, qrRect.x, qrRect.y, { width: qrRect.width, height: qrRect.height });
    }

    if (side === 'front' && printConfig?.debugPreviewQr) {
      console.log('[QR Trace] CTM before restore():', this.getCtmSnapshot(doc));
    }
    doc.restore();
    if (side === 'front' && printConfig?.debugPreviewQr) {
      console.log('[QR Trace] CTM after restore():', this.getCtmSnapshot(doc));
    }
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

  resolveTemplateDrawRect(slotRect, templateImageMeta, center = true) {
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
        y: slotRect.y + (center ? (slotRect.height - fittedHeight) / 2 : 0),
        width: slotRect.width,
        height: fittedHeight,
      };
    }

    const fittedWidth = slotRect.height * imageAspect;
    return {
      x: slotRect.x + (center ? (slotRect.width - fittedWidth) / 2 : 0),
      y: slotRect.y,
      width: fittedWidth,
      height: slotRect.height,
    };
  }

  resolveQrRectWithinDrawRect(drawRect, normalized = null) {
    if (normalized) {
      const { x, y, width, height } = normalized;
      if ([x, y, width, height].some(value => !Number.isFinite(value))
        || x < 0 || y < 0 || width <= 0 || height <= 0
        || x + width > 1.000001 || y + height > 1.000001) {
        throw new Error('Invalid QR placement relative to the template.');
      }
      // Image-relative coordinates preserve the same position in every PDF scale.
      const size = Math.min(width * drawRect.width, height * drawRect.height);
      return { drawRect, x: drawRect.x + x * drawRect.width,
        y: drawRect.y + y * drawRect.height, width: size, height: size };
    }
    // Measured INNER edges of the current official front PNG (880 x 1786 px).
    // Store the frame relative to the image so preview and production scale together.
    // These are frame bounds, not inherited QR placement or a fixed QR size.
    const frame = {
      x: drawRect.x + drawRect.width * (227 / 880),
      y: drawRect.y + drawRect.height * (976 / 1786),
      width: drawRect.width * (426 / 880),
      height: drawRect.height * (417 / 1786),
    };
    const padding = Math.min(frame.width, frame.height) * 0.05;
    const qrInnerSize = Math.min(frame.width, frame.height) - 2 * padding;
    return {
      drawRect,
      frame,
      padding,
      x: frame.x + (frame.width - qrInnerSize) / 2,
      y: frame.y + (frame.height - qrInnerSize) / 2,
      width: qrInnerSize,
      height: qrInnerSize,
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
