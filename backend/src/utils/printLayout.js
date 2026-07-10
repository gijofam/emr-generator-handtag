const { mmToPoints, DEFAULT_HANDTAG_WIDTH_MM, DEFAULT_HANDTAG_HEIGHT_MM, DEFAULT_BLEED_MM, DEFAULT_MARGIN_MM, DEFAULT_SPACING_MM } = require('./printConfig');

function calculateLayout({ paperSize, margins = {}, spacing = DEFAULT_SPACING_MM, bleed = DEFAULT_BLEED_MM, handtagWidth = DEFAULT_HANDTAG_WIDTH_MM, handtagHeight = DEFAULT_HANDTAG_HEIGHT_MM }) {
  const resolvedPaper = {
    width: paperSize.width,
    height: paperSize.height,
  };

  const resolvedMargins = {
    top: margins.top ?? DEFAULT_MARGIN_MM,
    right: margins.right ?? DEFAULT_MARGIN_MM,
    bottom: margins.bottom ?? DEFAULT_MARGIN_MM,
    left: margins.left ?? DEFAULT_MARGIN_MM,
  };

  const resolvedSpacing = spacing ?? DEFAULT_SPACING_MM;
  const resolvedBleed = bleed ?? DEFAULT_BLEED_MM;

  const effectiveWidth = handtagWidth + (resolvedBleed * 2);
  const effectiveHeight = handtagHeight + (resolvedBleed * 2);

  const usableWidth = resolvedPaper.width - resolvedMargins.left - resolvedMargins.right;
  const usableHeight = resolvedPaper.height - resolvedMargins.top - resolvedMargins.bottom;

  const columns = Math.max(1, Math.floor((usableWidth + resolvedSpacing) / (effectiveWidth + resolvedSpacing)));
  const rows = Math.max(1, Math.floor((usableHeight + resolvedSpacing) / (effectiveHeight + resolvedSpacing)));

  const handtagsPerPage = columns * rows;
  const totalArea = effectiveWidth * effectiveHeight;
  const paperArea = usableWidth * usableHeight;
  const utilization = Math.min(100, (handtagsPerPage * totalArea / paperArea) * 100);

  return {
    paper: resolvedPaper,
    margins: resolvedMargins,
    spacing: resolvedSpacing,
    bleed: resolvedBleed,
    handtagWidthMm: handtagWidth,
    handtagHeightMm: handtagHeight,
    effectiveWidthMm: effectiveWidth,
    effectiveHeightMm: effectiveHeight,
    usableWidthMm: usableWidth,
    usableHeightMm: usableHeight,
    columns,
    rows,
    handtagsPerPage,
    utilizationPercent: Number(utilization.toFixed(2)),
    handtagWidthPt: mmToPoints(effectiveWidth),
    handtagHeightPt: mmToPoints(effectiveHeight),
    pageWidthPt: mmToPoints(resolvedPaper.width),
    pageHeightPt: mmToPoints(resolvedPaper.height),
    usableWidthPt: mmToPoints(usableWidth),
    usableHeightPt: mmToPoints(usableHeight),
  };
}

module.exports = {
  calculateLayout,
};
