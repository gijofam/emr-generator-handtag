const CALIBRATION_KEY = 'emr.handtag.calibration.v1';
const ACTIVE_TEMPLATE_CACHE_KEY = 'emr.handtag.activeTemplate.front.v1';

export const HANDTAG_DIMENSIONS_MM = {
  width: 160,
  height: 65,
};

export const DEFAULT_QR_PLACEMENT = {
  x: 20,
  y: 18,
  width: 30,
  height: 30,
};

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePlacement(value = {}) {
  return {
    x: toFiniteNumber(value.x, DEFAULT_QR_PLACEMENT.x),
    y: toFiniteNumber(value.y, DEFAULT_QR_PLACEMENT.y),
    width: Math.max(1, toFiniteNumber(value.width, DEFAULT_QR_PLACEMENT.width)),
    height: Math.max(1, toFiniteNumber(value.height, DEFAULT_QR_PLACEMENT.height)),
  };
}

export function loadCalibrationConfig() {
  try {
    const raw = localStorage.getItem(CALIBRATION_KEY);
    if (!raw) {
      return {
        qrPlacement: { ...DEFAULT_QR_PLACEMENT },
        updatedAt: null,
      };
    }

    const parsed = JSON.parse(raw);
    return {
      qrPlacement: normalizePlacement(parsed.qrPlacement),
      updatedAt: parsed.updatedAt || null,
    };
  } catch (_error) {
    return {
      qrPlacement: { ...DEFAULT_QR_PLACEMENT },
      updatedAt: null,
    };
  }
}

export function saveCalibrationConfig(qrPlacement) {
  const payload = {
    qrPlacement: normalizePlacement(qrPlacement),
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(CALIBRATION_KEY, JSON.stringify(payload));
  return payload;
}

export function resetCalibrationConfig() {
  return saveCalibrationConfig(DEFAULT_QR_PLACEMENT);
}

export function getProductionPrintConfig() {
  const { qrPlacement } = loadCalibrationConfig();
  return { qrPlacement };
}

export function cacheActiveFrontTemplate({ fileName, dataUrl }) {
  if (!fileName || !dataUrl) {
    return;
  }

  const payload = {
    fileName,
    dataUrl,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(ACTIVE_TEMPLATE_CACHE_KEY, JSON.stringify(payload));
}

export function getCachedActiveFrontTemplate() {
  try {
    const raw = localStorage.getItem(ACTIVE_TEMPLATE_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.fileName || !parsed?.dataUrl) {
      return null;
    }

    return parsed;
  } catch (_error) {
    return null;
  }
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
    reader.readAsDataURL(file);
  });
}