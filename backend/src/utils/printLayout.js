const { mmToPoints, DEFAULT_HANDTAG_WIDTH_MM, DEFAULT_HANDTAG_HEIGHT_MM, DEFAULT_BLEED_MM, DEFAULT_MARGIN_MM, DEFAULT_SPACING_MM } = require('./printConfig');

function calculateLayout({ paperSize, margins = {}, spacing = DEFAULT_SPACING_MM, bleed = DEFAULT_BLEED_MM, handtagWidth = DEFAULT_HANDTAG_WIDTH_MM, handtagHeight = DEFAULT_HANDTAG_HEIGHT_MM, handtagCount = 1 }) {
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

  const dimensions = [resolvedPaper.width, resolvedPaper.height, handtagWidth, handtagHeight];
  const offsets = [...Object.values(resolvedMargins), resolvedSpacing, resolvedBleed];
  if (dimensions.some(value => !Number.isFinite(value) || value <= 0)
    || offsets.some(value => !Number.isFinite(value) || value < 0)) {
    throw new Error('Print dimensions must be positive and margins, bleed and spacing non-negative.');
  }

  const usableWidth = resolvedPaper.width - resolvedMargins.left - resolvedMargins.right;
  const usableHeight = resolvedPaper.height - resolvedMargins.top - resolvedMargins.bottom;

  const orientationCandidates = [
    { width: handtagWidth, height: handtagHeight },
    { width: handtagHeight, height: handtagWidth },
  ];

  let bestLayout = null;
  for (const candidate of orientationCandidates) {
    const candidateEffectiveWidth = candidate.width + (resolvedBleed * 2);
    const candidateEffectiveHeight = candidate.height + (resolvedBleed * 2);
    const candidateColumns = Math.max(0, Math.floor((usableWidth + resolvedSpacing) / (candidateEffectiveWidth + resolvedSpacing)));
    const candidateRows = Math.max(0, Math.floor((usableHeight + resolvedSpacing) / (candidateEffectiveHeight + resolvedSpacing)));
    const candidatePerPage = candidateColumns * candidateRows;

    const shouldReplace = !bestLayout
      || candidatePerPage > bestLayout.handtagsPerPage
      || (candidatePerPage === bestLayout.handtagsPerPage && candidate.height > candidate.width);

    if (shouldReplace) {
      bestLayout = {
        handtagWidth: candidate.width,
        handtagHeight: candidate.height,
        effectiveWidth: candidateEffectiveWidth,
        effectiveHeight: candidateEffectiveHeight,
        columns: candidateColumns,
        rows: candidateRows,
        handtagsPerPage: candidatePerPage,
      };
    }
  }

  if (!bestLayout || bestLayout.handtagsPerPage === 0) {
    throw new Error('No handtag fits within the paper size and margins.');
  }

  const handtagWidthMm = bestLayout.handtagWidth;
  const handtagHeightMm = bestLayout.handtagHeight;
  const effectiveWidth = bestLayout.effectiveWidth;
  const effectiveHeight = bestLayout.effectiveHeight;
  const columns = bestLayout.columns;
  const rows = bestLayout.rows;

  const gridWidthMm = columns * effectiveWidth + (columns - 1) * resolvedSpacing;
  const gridHeightMm = rows * effectiveHeight + (rows - 1) * resolvedSpacing;
  // Center the complete grid once. Default exterior margins are zero.
  const startXMm = resolvedMargins.left + (usableWidth - gridWidthMm) / 2;
  const startYMm = resolvedMargins.top + (usableHeight - gridHeightMm) / 2;

  const handtagsPerPage = columns * rows;
  const totalArea = effectiveWidth * effectiveHeight;
  const paperArea = usableWidth * usableHeight;
  const utilization = handtagsPerPage > 0 ? Math.min(100, (handtagsPerPage * totalArea / paperArea) * 100) : 0;
  const pagesRequired = Math.max(1, Math.ceil(handtagCount / handtagsPerPage));

  return {
    paper: resolvedPaper,
    margins: resolvedMargins,
    spacing: resolvedSpacing,
    bleed: resolvedBleed,
    handtagWidthMm,
    handtagHeightMm,
    effectiveWidthMm: effectiveWidth,
    effectiveHeightMm: effectiveHeight,
    usableWidthMm: usableWidth,
    usableHeightMm: usableHeight,
    gridWidthMm,
    gridHeightMm,
    startXMm,
    startYMm,
    orientation: handtagHeightMm >= handtagWidthMm ? 'vertical' : 'horizontal',
    columns,
    rows,
    handtagsPerPage,
    pagesRequired,
    utilizationPercent: Number(utilization.toFixed(2)),
    handtagWidthPt: mmToPoints(effectiveWidth),
    handtagHeightPt: mmToPoints(effectiveHeight),
    pageWidthPt: mmToPoints(resolvedPaper.width),
    pageHeightPt: mmToPoints(resolvedPaper.height),
    usableWidthPt: mmToPoints(usableWidth),
    usableHeightPt: mmToPoints(usableHeight),
    startXPt: mmToPoints(startXMm),
    startYPt: mmToPoints(startYMm),
  };
}

module.exports = {
  calculateLayout,
};
