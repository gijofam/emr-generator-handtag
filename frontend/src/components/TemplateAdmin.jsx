import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/api';

function fileToTemplatePayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve({
        fileName: file.name,
        mimeType: file.type || 'image/png',
        base64,
      });
    };
    reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function TemplateAdmin() {
  const [config, setConfig] = useState(null);
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const frontInputRef = useRef(null);
  const backInputRef = useRef(null);

  useEffect(() => {
    fetchTemplateConfig();
  }, []);

  async function fetchTemplateConfig() {
    try {
      setLoading(true);
      const data = await apiClient.getTemplateConfig();
      setConfig(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (saving) {
      return;
    }

    if (!frontFile && !backFile) {
      setError('Selecciona al menos una plantilla PNG.');
      setShowConfirm(false);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const [frontTemplate, backTemplate] = await Promise.all([
        frontFile ? fileToTemplatePayload(frontFile) : Promise.resolve(null),
        backFile ? fileToTemplatePayload(backFile) : Promise.resolve(null),
      ]);

      const updated = await apiClient.saveTemplateConfig({ frontTemplate, backTemplate });
      setConfig(updated);
      window.dispatchEvent(new CustomEvent('templates:updated', { detail: updated }));
      setFrontFile(null);
      setBackFile(null);
      setFileInputKey(prev => prev + 1);
      if (frontInputRef.current) frontInputRef.current.value = '';
      if (backInputRef.current) backInputRef.current.value = '';
      setSuccess('Plantillas activadas correctamente.');
    } catch (err) {
      setError(
        err.name === 'AbortError'
          ? 'La conexión tardó demasiado. Verifica que el backend esté activo e inténtalo de nuevo.'
          : err.message
      );
    } finally {
      setSaving(false);
      setShowConfirm(false);
    }
  }

  function openConfirm() {
    if (!frontFile && !backFile) {
      setError('Selecciona al menos una plantilla PNG antes de activar.');
      return;
    }
    setError(null);
    setShowConfirm(true);
  }

  if (loading) {
    return <div className="section-card">Cargando plantillas...</div>;
  }

  return (
    <>
      <div className="section-card template-admin-card">
        <h2>Plantillas</h2>
        <p className="info-message template-admin-note">
          Selecciona las plantillas PNG activas del sistema desde aquí.
        </p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-badge">{success}</div>}

        <div className="template-status-grid">
          <div className="template-status-item">
            <span className="template-status-label">Frontal activa</span>
            <strong>{config?.front?.fileName || 'No configurada'}</strong>
          </div>
          <div className="template-status-item">
            <span className="template-status-label">Trasera activa</span>
            <strong>{config?.back?.fileName || 'No configurada'}</strong>
          </div>
        </div>

        <div className="template-upload-grid">
          <label className="template-upload-field">
            <span>Handtag Frontal (.png)</span>
            <input
              key={`front-${fileInputKey}`}
              ref={frontInputRef}
              type="file"
              accept="image/png"
              onChange={e => setFrontFile(e.target.files?.[0] || null)}
            />
            <small>{frontFile ? frontFile.name : 'Sin archivo seleccionado'}</small>
          </label>

          <label className="template-upload-field">
            <span>Handtag Reverso (.png)</span>
            <input
              key={`back-${fileInputKey}`}
              ref={backInputRef}
              type="file"
              accept="image/png"
              onChange={e => setBackFile(e.target.files?.[0] || null)}
            />
            <small>{backFile ? backFile.name : 'Sin archivo seleccionado'}</small>
          </label>
        </div>

        <button
          className="btn btn-primary template-save-button"
          onClick={openConfirm}
          disabled={saving}
        >
          {saving ? 'Guardando...' : 'Activar plantillas'}
        </button>
      </div>

      {showConfirm && (
        <div className="template-modal-backdrop" role="presentation" onClick={() => !saving && setShowConfirm(false)}>
          <div className="template-modal" role="dialog" aria-modal="true" aria-labelledby="template-modal-title" onClick={event => event.stopPropagation()}>
            <h3 id="template-modal-title">Confirmar activación</h3>
            <p>
              Vas a guardar las plantillas seleccionadas como activas. El PDF usará esas imágenes en los próximos lotes.
            </p>
            <div className="template-modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)} disabled={saving}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Sí, activar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
