import { useEffect, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { apiClient } from '../services/api';
import {
  HANDTAG_DIMENSIONS_MM,
  DEFAULT_QR_PLACEMENT,
  loadCalibrationConfig,
  saveCalibrationConfig,
  resetCalibrationConfig,
} from '../services/calibrationStore';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePlacementMm(value) {
  const size = clamp(Math.min(toNumber(value?.width, DEFAULT_QR_PLACEMENT.width),
    toNumber(value?.height, DEFAULT_QR_PLACEMENT.height)), 1,
  Math.min(HANDTAG_DIMENSIONS_MM.width, HANDTAG_DIMENSIONS_MM.height));
  const nextWidth = size;
  const nextHeight = size;

  return {
    x: clamp(toNumber(value?.x, DEFAULT_QR_PLACEMENT.x), 0, HANDTAG_DIMENSIONS_MM.width - nextWidth),
    y: clamp(toNumber(value?.y, DEFAULT_QR_PLACEMENT.y), 0, HANDTAG_DIMENSIONS_MM.height - nextHeight),
    width: nextWidth,
    height: nextHeight,
  };
}

function readVisibleImageRect(image, stage) {
  const visible = image.getBoundingClientRect();
  const origin = stage.getBoundingClientRect();
  return {
    x: visible.left - origin.left - stage.clientLeft,
    y: visible.top - origin.top - stage.clientTop,
    width: visible.width,
    height: visible.height,
  };
}

function normalizeRectPx(rect, imageRect) {
  if (!imageRect.width || !imageRect.height) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const minWidth = Math.max(12, imageRect.width * 0.03);
  const minHeight = Math.max(12, imageRect.height * 0.03);
  const size = clamp(Math.min(toNumber(rect?.width, minWidth), toNumber(rect?.height, minHeight)),
    Math.min(Math.max(minWidth, minHeight), imageRect.width, imageRect.height),
    Math.min(imageRect.width, imageRect.height));
  const width = size;
  const height = size;

  return {
    x: clamp(toNumber(rect?.x, 0), 0, imageRect.width - width),
    y: clamp(toNumber(rect?.y, 0), 0, imageRect.height - height),
    width,
    height,
  };
}

// Match the PDF contain scale: both axes use the same physical scale.
function calibrationMmPerPx(imageRect) {
  return Math.min(
    HANDTAG_DIMENSIONS_MM.width / imageRect.width,
    HANDTAG_DIMENSIONS_MM.height / imageRect.height,
  );
}

function mmToPx(placementMm, imageRect) {
  if (!imageRect.width || !imageRect.height) return normalizeRectPx({}, imageRect);
  const scale = calibrationMmPerPx(imageRect);
  const size = Math.min(placementMm.width, placementMm.height) / scale;
  return normalizeRectPx({
    x: placementMm.x / scale,
    y: placementMm.y / scale,
    width: size,
    height: size,
  }, imageRect);
}

function pxToMm(rectPx, imageRect) {
  if (!imageRect.width || !imageRect.height) return normalizePlacementMm(DEFAULT_QR_PLACEMENT);
  const scale = calibrationMmPerPx(imageRect);
  const size = Math.min(rectPx.width, rectPx.height) * scale;
  return normalizePlacementMm({
    x: rectPx.x * scale,
    y: rectPx.y * scale,
    width: size,
    height: size,
  });
}

function normalizedPlacement(rect, imageRect) {
  return { x: rect.x / imageRect.width, y: rect.y / imageRect.height,
    width: rect.width / imageRect.width, height: rect.height / imageRect.height };
}

function parseSize(value) {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number.parseFloat(String(value).replace('px', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CalibrationPanel() {
  const imageRef = useRef(null);
  const stageRef = useRef(null);
  const prevImageRectRef = useRef({ width: 0, height: 0 });
  const previewObjectUrlRef = useRef('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [templateMeta, setTemplateMeta] = useState(null);
  const [frontTemplateDataUrl, setFrontTemplateDataUrl] = useState('');
  const [imageRect, setImageRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [savedPlacementMm, setSavedPlacementMm] = useState(() => normalizePlacementMm(loadCalibrationConfig().qrPlacement));
  const [qrRectPx, setQrRectPx] = useState(null);
  const [draftValues, setDraftValues] = useState({ x: '', y: '', width: '', height: '' });
  const [activeInput, setActiveInput] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewDownloadUrl, setPreviewDownloadUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [previewOffsetMm, setPreviewOffsetMm] = useState({ x: '0', y: '0' });

  const [calibrationQrDataUrl, setCalibrationQrDataUrl] = useState('');
  const defaultPlacementRef = useRef(DEFAULT_QR_PLACEMENT);

  const qrPlacementMm = useMemo(() => {
    if (!qrRectPx || !imageRect.width || !imageRect.height) {
      return savedPlacementMm;
    }
    return pxToMm(qrRectPx, imageRect);
  }, [imageRect, qrRectPx, savedPlacementMm]);

  useEffect(() => {
    let mounted = true;

    async function syncActiveTemplate() {
      try {
        setLoading(true);
        const [templateInfo, assets] = await Promise.all([
          apiClient.getTemplateConfig(), apiClient.getCalibrationAssets(),
        ]);
        if (!mounted) return;

        const frontInfo = templateInfo?.front || null;
        setTemplateMeta(frontInfo);

        if (frontInfo) {
          setFrontTemplateDataUrl(assets.templateDataUrl);
          setCalibrationQrDataUrl(assets.qrDataUrl);
          defaultPlacementRef.current = assets.defaultQrPlacement;
          const saved = loadCalibrationConfig();
          const normalized = saved.qrPlacementNormalized;
          const reference = assets.referenceSizeMm;
          setSavedPlacementMm(normalized ? {
            x: normalized.x * reference.width, y: normalized.y * reference.height,
            width: normalized.width * reference.width, height: normalized.height * reference.height,
          } : assets.defaultQrPlacement);
          setQrRectPx(null);
        } else {
          setFrontTemplateDataUrl('');
        }

        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || 'No se pudo cargar la plantilla activa.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    syncActiveTemplate();

    const onTemplatesUpdated = () => {
      syncActiveTemplate();
    };

    window.addEventListener('templates:updated', onTemplatesUpdated);

    return () => {
      mounted = false;
      window.removeEventListener('templates:updated', onTemplatesUpdated);
    };
  }, []);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return undefined;

    const updateRect = () => {
      const stage = stageRef.current;
      const imgBoundingRect = image.getBoundingClientRect();
      const stageBoundingRect = stage?.getBoundingClientRect?.();
      const next = readVisibleImageRect(image, stage);

      const imageRectSides = {
        left: next.x,
        top: next.y,
        right: next.x + next.width,
        bottom: next.y + next.height,
      };

      const imgLocalSides = stageBoundingRect
        ? {
          left: imgBoundingRect.left - stageBoundingRect.left,
          top: imgBoundingRect.top - stageBoundingRect.top,
          right: imgBoundingRect.right - stageBoundingRect.left,
          bottom: imgBoundingRect.bottom - stageBoundingRect.top,
        }
        : {
          left: image.offsetLeft,
          top: image.offsetTop,
          right: image.offsetLeft + image.clientWidth,
          bottom: image.offsetTop + image.clientHeight,
        };

      console.log('imageRect =', next);
      console.log('img.getBoundingClientRect() =', {
        x: imgBoundingRect.x,
        y: imgBoundingRect.y,
        width: imgBoundingRect.width,
        height: imgBoundingRect.height,
        left: imgBoundingRect.left,
        top: imgBoundingRect.top,
        right: imgBoundingRect.right,
        bottom: imgBoundingRect.bottom,
      });
      console.log(`img.clientWidth: ${image.clientWidth}`);
      console.log(`img.clientHeight: ${image.clientHeight}`);
      console.log(`img.naturalWidth: ${image.naturalWidth}`);
      console.log(`img.naturalHeight: ${image.naturalHeight}`);
      console.log('px->mm conversion reference rect: imageRect (clientWidth/clientHeight)');
      console.log('imageRect vs <img> side difference (px):', {
        left: imgLocalSides.left - imageRectSides.left,
        right: imgLocalSides.right - imageRectSides.right,
        top: imgLocalSides.top - imageRectSides.top,
        bottom: imgLocalSides.bottom - imageRectSides.bottom,
      });

      setImageRect(next);
    };

    updateRect();

    const observer = new ResizeObserver(() => updateRect());
    observer.observe(image);

    return () => observer.disconnect();
  }, [frontTemplateDataUrl]);

  useEffect(() => {
    const hasImage = imageRect.width > 0 && imageRect.height > 0;
    if (!hasImage) return;

    setQrRectPx(current => {
      if (!current) {
        return mmToPx(savedPlacementMm, imageRect);
      }

      const prev = prevImageRectRef.current;
      if (!prev.width || !prev.height) {
        return normalizeRectPx(current, imageRect);
      }

      const widthRatio = imageRect.width / prev.width;
      const heightRatio = imageRect.height / prev.height;
      if (widthRatio === 1 && heightRatio === 1) {
        return normalizeRectPx(current, imageRect);
      }

      return normalizeRectPx(
        {
          x: current.x * widthRatio,
          y: current.y * heightRatio,
          width: current.width * widthRatio,
          height: current.height * heightRatio,
        },
        imageRect,
      );
    });

    prevImageRectRef.current = imageRect;
  }, [imageRect.height, imageRect.width, savedPlacementMm]);

  useEffect(() => {
    if (!qrRectPx || activeInput) return;

    setDraftValues({
      x: String(Math.round(qrRectPx.x)),
      y: String(Math.round(qrRectPx.y)),
      width: String(Math.round(qrRectPx.width)),
      height: String(Math.round(qrRectPx.height)),
    });
  }, [activeInput, qrRectPx]);

  useEffect(() => {
    const onKeyDown = event => {
      if (!qrRectPx) return;

      const target = event.target;
      const tagName = target?.tagName?.toLowerCase?.() || '';
      if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) {
        return;
      }

      const step = event.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;

      if (event.key === 'ArrowLeft') dx = -step;
      if (event.key === 'ArrowRight') dx = step;
      if (event.key === 'ArrowUp') dy = -step;
      if (event.key === 'ArrowDown') dy = step;
      if (!dx && !dy) return;

      event.preventDefault();
      updateQrRect({
        ...qrRectPx,
        x: qrRectPx.x + dx,
        y: qrRectPx.y + dy,
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [qrRectPx]);

  useEffect(() => {
    const onWheel = event => {
      if (!qrRectPx || !event.shiftKey) return;

      event.preventDefault();
      const step = event.deltaY < 0 ? 1 : -1;
      updateQrRect({
        ...qrRectPx,
        width: qrRectPx.width + step,
        height: qrRectPx.height + step,
      });
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [qrRectPx]);

  function updateQrRect(nextRect) {
    setQrRectPx(normalizeRectPx(nextRect, imageRect));
  }

  function handleInputChange(field, rawValue) {
    const isSize = field === 'width' || field === 'height';
    setDraftValues(prev => ({
      ...prev,
      [field]: rawValue,
      ...(isSize ? { width: rawValue, height: rawValue } : {}),
    }));
    const size = Number(rawValue);
    if (isSize && qrRectPx && rawValue.trim() !== '' && Number.isFinite(size) && size > 0) {
      updateQrRect({ ...qrRectPx, width: size, height: size });
    }
  }

  function handleQrResize(_event, _direction, ref, _delta, position) {
    updateQrRect({ ...position, width: parseSize(ref.style.width), height: parseSize(ref.style.height) });
  }

  function commitInputValue(field) {
    setActiveInput(null);
    if (!qrRectPx) return;

    const rawValue = String(draftValues[field] ?? '').trim();
    if (rawValue === '') {
      setDraftValues(prev => ({
        ...prev,
        [field]: String(Math.round(qrRectPx[field])),
      }));
      return;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      setDraftValues(prev => ({
        ...prev,
        [field]: String(Math.round(qrRectPx[field])),
      }));
      return;
    }

    updateQrRect({
      ...qrRectPx,
      [field]: parsed,
      ...((field === 'width' || field === 'height') ? { width: parsed, height: parsed } : {}),
    });
  }

  function handleSaveCalibration() {
    if (!qrRectPx || !imageRect.width || !imageRect.height) {
      setStatusMessage('Ajusta el QR sobre la imagen antes de guardar.');
      return;
    }

    const payload = pxToMm(qrRectPx, imageRect);
    console.log('px:');
    console.log(`x: ${qrRectPx.x}`);
    console.log(`y: ${qrRectPx.y}`);
    console.log(`width: ${qrRectPx.width}`);
    console.log(`height: ${qrRectPx.height}`);
    console.log('mm:');
    console.log(`x: ${payload.x}`);
    console.log(`y: ${payload.y}`);
    console.log(`width: ${payload.width}`);
    console.log(`height: ${payload.height}`);
    const saved = saveCalibrationConfig(payload, normalizedPlacement(qrRectPx, imageRect));
    setSavedPlacementMm(saved.qrPlacement);
    setStatusMessage(`Configuración guardada (${new Date(saved.updatedAt).toLocaleString()}).`);
  }

  function handleResetCalibration() {
    const defaults = defaultPlacementRef.current;
    const rect = mmToPx(defaults, imageRect);
    const reset = resetCalibrationConfig(defaults, normalizedPlacement(rect, imageRect));
    const normalizedMm = normalizePlacementMm(reset.qrPlacement);
    setSavedPlacementMm(normalizedMm);

    if (imageRect.width && imageRect.height) {
      setQrRectPx(mmToPx(normalizedMm, imageRect));
    } else {
      setQrRectPx(null);
    }

    setStatusMessage('Configuración restablecida a valores por defecto.');
  }

  function handleCenter() {
    if (!qrRectPx) return;

    updateQrRect({
      ...qrRectPx,
      x: (imageRect.width - qrRectPx.width) / 2,
      y: (imageRect.height - qrRectPx.height) / 2,
    });
  }

  async function handlePreviewHandtag() {
    if (!qrRectPx) {
      setPreviewError('No hay calibración válida para generar el PDF de prueba.');
      return;
    }

    setPreviewLoading(true);
    setPreviewError('');
    setPreviewDownloadUrl('');
    setStatusMessage('');

    try {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = '';
      }

      const previewOffsetPayload = {
        x: Number(previewOffsetMm.x) || 0,
        y: Number(previewOffsetMm.y) || 0,
      };

      console.log('[Trace][CalibrationPanel] qrPlacement antes de generateCalibrationPreview:', qrPlacementMm);
      const result = await apiClient.generateCalibrationPreview({
        qrPlacement: qrPlacementMm,
        qrPlacementNormalized: normalizedPlacement(qrRectPx, imageRect),
        previewOffsetMm: previewOffsetPayload,
      });

      setPreviewDownloadUrl(result.downloadUrl);
      setStatusMessage('PDF de prueba generado correctamente.');
    } catch (error) {
      setPreviewError(error.message || 'No se pudo generar el PDF de prueba.');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDownloadPreviewPdf() {
    if (!previewDownloadUrl) return;

    try {
      const blob = await apiClient.downloadPreviewFile(previewDownloadUrl);
      const objectUrl = URL.createObjectURL(blob);
      previewObjectUrlRef.current = objectUrl;

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'preview.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        if (previewObjectUrlRef.current === objectUrl) {
          previewObjectUrlRef.current = '';
        }
      }, 1000);
    } catch (error) {
      setPreviewError(error.message || 'No se pudo descargar el PDF de prueba.');
    }
  }

  return (
    <div className="section-card calibration-card">
      <h2>Calibración</h2>
      <p className="calibration-description">
        Ajusta el QR sobre la plantilla frontal activa en píxeles visuales. Al guardar se convierte automáticamente a milímetros.
      </p>

      {loading && <p className="info-message">Cargando plantilla activa...</p>}
      {!loading && error && <div className="error-message">{error}</div>}

      {!loading && !error && (
        <div className="calibration-layout">
          <div className="calibration-workspace-column">
            <div className="calibration-toolbar">
              <button type="button" className="btn btn-secondary" onClick={() => setShowGrid(prev => !prev)}>
                {showGrid ? 'Ocultar cuadrícula' : 'Mostrar cuadrícula'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleCenter} disabled={!qrRectPx}>
                Ajustar al centro
              </button>
            </div>

            <div className="handtag-frame">
              {frontTemplateDataUrl ? (
                <div className="handtag-stage" aria-label="Vista previa de calibración" ref={stageRef}>
                  <img
                    ref={imageRef}
                    className="handtag-template-image"
                    src={frontTemplateDataUrl}
                    alt="Plantilla frontal activa"
                    onLoad={() => {
                      const image = imageRef.current;
                      const stage = stageRef.current;
                      if (!image) return;
                      const imgBoundingRect = image.getBoundingClientRect();
                      const stageBoundingRect = stage?.getBoundingClientRect?.();
                      const nextRect = readVisibleImageRect(image, stage);

                      const imageRectSides = {
                        left: nextRect.x,
                        top: nextRect.y,
                        right: nextRect.x + nextRect.width,
                        bottom: nextRect.y + nextRect.height,
                      };

                      const imgLocalSides = stageBoundingRect
                        ? {
                          left: imgBoundingRect.left - stageBoundingRect.left,
                          top: imgBoundingRect.top - stageBoundingRect.top,
                          right: imgBoundingRect.right - stageBoundingRect.left,
                          bottom: imgBoundingRect.bottom - stageBoundingRect.top,
                        }
                        : {
                          left: image.offsetLeft,
                          top: image.offsetTop,
                          right: image.offsetLeft + image.clientWidth,
                          bottom: image.offsetTop + image.clientHeight,
                        };

                      console.log('imageRect =', nextRect);
                      console.log('img.getBoundingClientRect() =', {
                        x: imgBoundingRect.x,
                        y: imgBoundingRect.y,
                        width: imgBoundingRect.width,
                        height: imgBoundingRect.height,
                        left: imgBoundingRect.left,
                        top: imgBoundingRect.top,
                        right: imgBoundingRect.right,
                        bottom: imgBoundingRect.bottom,
                      });
                      console.log(`img.clientWidth: ${image.clientWidth}`);
                      console.log(`img.clientHeight: ${image.clientHeight}`);
                      console.log(`img.naturalWidth: ${image.naturalWidth}`);
                      console.log(`img.naturalHeight: ${image.naturalHeight}`);
                      console.log('px->mm conversion reference rect: imageRect (clientWidth/clientHeight)');
                      console.log('imageRect vs <img> side difference (px):', {
                        left: imgLocalSides.left - imageRectSides.left,
                        right: imgLocalSides.right - imageRectSides.right,
                        top: imgLocalSides.top - imageRectSides.top,
                        bottom: imgLocalSides.bottom - imageRectSides.bottom,
                      });

                      setImageRect(nextRect);
                      prevImageRectRef.current = nextRect;
                      setQrRectPx(mmToPx(savedPlacementMm, nextRect));
                    }}
                  />

                  {imageRect.width > 0 && imageRect.height > 0 && qrRectPx && (
                    <div className="handtag-overlay" aria-hidden="true"
                      style={{ left: imageRect.x, top: imageRect.y, width: imageRect.width, height: imageRect.height }}>
                      {showGrid && <div
                        className="guide-horizontal"
                        style={{ top: qrRectPx.y + qrRectPx.height / 2, left: 0, width: imageRect.width }}
                      />}
                      {showGrid && <div
                        className="guide-vertical"
                        style={{ left: qrRectPx.x + qrRectPx.width / 2, top: 0, height: imageRect.height }}
                      />}

                      <Rnd
                        className="calibration-rnd calibration-guides"
                        bounds="parent"
                        lockAspectRatio={1}
                        size={{ width: qrRectPx.width, height: qrRectPx.height }}
                        position={{ x: qrRectPx.x, y: qrRectPx.y }}
                        onDrag={(_event, data) => {
                          updateQrRect({
                            ...qrRectPx,
                            x: data.x,
                            y: data.y,
                          });
                        }}
                        onResize={handleQrResize}
                        onResizeStop={handleQrResize}
                        enableResizing={{
                          top: false,
                          right: false,
                          bottom: false,
                          left: false,
                          topRight: true,
                          bottomRight: true,
                          bottomLeft: true,
                          topLeft: true,
                        }}
                        resizeHandleClasses={{
                          topRight: 'qr-handle qr-handle-tr',
                          bottomRight: 'qr-handle qr-handle-br',
                          bottomLeft: 'qr-handle qr-handle-bl',
                          topLeft: 'qr-handle qr-handle-tl',
                        }}
                        style={{
                          zIndex: 5,
                          border: 0,
                          outline: 'none',
                          backgroundImage: `url(${calibrationQrDataUrl})`,
                          backgroundSize: 'contain',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
                          boxSizing: 'border-box',
                          margin: 0,
                          padding: 0,
                          overflow: 'hidden',
                          boxShadow: 'none',
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="info-message calibration-warning">
                  No hay plantilla frontal activa. Actívala desde Plantillas para visualizarla aquí.
                </div>
              )}
            </div>

            <div className="calibration-hints">
              <p>Interacción visual: píxeles sobre imagen</p>
              <p>Drag y resize con react-rnd</p>
              <p>Guardado: conversión automática a mm</p>
            </div>
          </div>

          <aside className="calibration-properties">
            <h3>Propiedades (px en imagen visible)</h3>

            <label>
              X (px)
              <input
                type="number"
                value={draftValues.x}
                onChange={e => handleInputChange('x', e.target.value)}
                onFocus={() => setActiveInput('x')}
                onBlur={() => commitInputValue('x')}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                disabled={!qrRectPx}
              />
            </label>

            <label>
              Y (px)
              <input
                type="number"
                value={draftValues.y}
                onChange={e => handleInputChange('y', e.target.value)}
                onFocus={() => setActiveInput('y')}
                onBlur={() => commitInputValue('y')}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                disabled={!qrRectPx}
              />
            </label>

            <label>
              Width (px)
              <input
                type="number"
                value={draftValues.width}
                onChange={e => handleInputChange('width', e.target.value)}
                onFocus={() => setActiveInput('width')}
                onBlur={() => commitInputValue('width')}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                disabled={!qrRectPx}
              />
            </label>

            <label>
              Height (px)
              <input
                type="number"
                value={draftValues.height}
                onChange={e => handleInputChange('height', e.target.value)}
                onFocus={() => setActiveInput('height')}
                onBlur={() => commitInputValue('height')}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                disabled={!qrRectPx}
              />
            </label>

            <label>
              Inicio X (mm)
              <input
                type="number"
                value={previewOffsetMm.x}
                onChange={e => setPreviewOffsetMm(prev => ({ ...prev, x: e.target.value }))}
              />
            </label>

            <label>
              Inicio Y (mm)
              <input
                type="number"
                value={previewOffsetMm.y}
                onChange={e => setPreviewOffsetMm(prev => ({ ...prev, y: e.target.value }))}
              />
            </label>

            <div className="calibration-actions">
              <button type="button" className="btn btn-primary" onClick={handleSaveCalibration}>
                Guardar configuración
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleResetCalibration}>
                Restablecer configuración
              </button>
              <button type="button" className="btn btn-secondary" onClick={handlePreviewHandtag} disabled={previewLoading}>
                Generar PDF de prueba
              </button>
            </div>

            {previewLoading && <div className="info-message">Generando PDF...</div>}
            {previewError && <div className="error-message">{previewError}</div>}
            {statusMessage && !previewLoading && !previewError && <div className="success-badge">{statusMessage}</div>}

            {previewDownloadUrl && !previewLoading && !previewError && (
              <button type="button" className="btn btn-primary" onClick={handleDownloadPreviewPdf}>
                ⬇ Descargar PDF de prueba
              </button>
            )}

            <p className="calibration-meta">
              Valores persistidos (mm): X {qrPlacementMm.x.toFixed(2)} | Y {qrPlacementMm.y.toFixed(2)} | W{' '}
              {qrPlacementMm.width.toFixed(2)} | H {qrPlacementMm.height.toFixed(2)}
            </p>
            <p className="calibration-meta">Plantilla activa: {templateMeta?.fileName || 'No configurada'}</p>
          </aside>
        </div>
      )}
    </div>
  );
}
