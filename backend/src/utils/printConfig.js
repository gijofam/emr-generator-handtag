const fs = require('fs');
const path = require('path');

const MM_TO_POINTS = 2.83464567;
const DEFAULT_HANDTAG_WIDTH_MM = 65;
const DEFAULT_HANDTAG_HEIGHT_MM = 140;
const DEFAULT_BLEED_MM = 2;
const DEFAULT_MARGIN_MM = 0;
const DEFAULT_SPACING_MM = 1;

function mmToPoints(mm) {
  return mm * MM_TO_POINTS;
}

function getPaperSize(sizeKey, customSize = null) {
  const presets = {
    A4: { width: 210, height: 297 },
    A3: { width: 297, height: 420 },
    SRA3: { width: 320, height: 450 },
    '50x70': { width: 500, height: 700 },
    '65x95': { width: 650, height: 950 },
  };

  if (customSize) {
    return {
      width: customSize.width,
      height: customSize.height,
    };
  }

  return presets[sizeKey] || presets.A4;
}

function getDefaultQrPlacement() {
  return {
    x: 13,
    y: 74,
    width: 30,
    height: 30,
  };
}

function resolveTemplatePath(templatePath) {
  if (!templatePath) {
    return null;
  }

  const candidates = [];
  if (path.isAbsolute(templatePath)) {
    candidates.push(templatePath);
  }

  candidates.push(path.resolve(process.cwd(), templatePath));
  candidates.push(path.resolve(process.cwd(), '..', templatePath));
  candidates.push(path.resolve(__dirname, '../../../', templatePath));

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0] || null;
}

function normalizePrintConfig(config = {}) {
  const qrPlacement = {
    ...(getDefaultQrPlacement()),
    ...(config.qrPlacement || {}),
  };

  const margins = {
    top: Number(config.margins?.top ?? config.margins?.vertical ?? config.marginMm ?? DEFAULT_MARGIN_MM),
    right: Number(config.margins?.right ?? config.margins?.horizontal ?? config.marginMm ?? DEFAULT_MARGIN_MM),
    bottom: Number(config.margins?.bottom ?? config.margins?.vertical ?? config.marginMm ?? DEFAULT_MARGIN_MM),
    left: Number(config.margins?.left ?? config.margins?.horizontal ?? config.marginMm ?? DEFAULT_MARGIN_MM),
  };

  return {
    handtagWidthMm: Number(config.handtagWidthMm ?? DEFAULT_HANDTAG_WIDTH_MM),
    handtagHeightMm: Number(config.handtagHeightMm ?? DEFAULT_HANDTAG_HEIGHT_MM),
    bleedMm: Number(config.bleedMm ?? DEFAULT_BLEED_MM),
    marginMm: Number(config.marginMm ?? DEFAULT_MARGIN_MM),
    spacingMm: Number(config.spacingMm ?? DEFAULT_SPACING_MM),
    paperSize: config.paperSize || 'A4',
    paperWidthMm: Number(config.paperWidthMm ?? 210),
    paperHeightMm: Number(config.paperHeightMm ?? 297),
    imposition: config.imposition !== undefined ? Boolean(config.imposition) : true,
    margins,
    qrPlacement,
    templateFrontPath: config.templateFrontPath || '',
    templateBackPath: config.templateBackPath || '',
  };
}

module.exports = {
  MM_TO_POINTS,
  DEFAULT_HANDTAG_WIDTH_MM,
  DEFAULT_HANDTAG_HEIGHT_MM,
  DEFAULT_BLEED_MM,
  DEFAULT_MARGIN_MM,
  DEFAULT_SPACING_MM,
  mmToPoints,
  getPaperSize,
  getDefaultQrPlacement,
  resolveTemplatePath,
  normalizePrintConfig,
};
