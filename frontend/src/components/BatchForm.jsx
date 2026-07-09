import { useState } from 'react';
import { apiClient } from '../services/api';

export function BatchForm({ productId, onBatchGenerated }) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!productId) {
      alert('Por favor selecciona un producto');
      return;
    }
    if (quantity < 1 || quantity > 1000) {
      alert('La cantidad debe estar entre 1 y 1000');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const batchResult = await apiClient.generateBatch(productId, quantity, notes);
      setResult(batchResult);
      setQuantity(1);
      setNotes('');
      onBatchGenerated?.(batchResult);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(downloadUrl) {
    try {
      const fileName = downloadUrl.split('/').pop();
      const blob = await apiClient.downloadFile(result.batchId, decodeURIComponent(fileName));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(`Error descargando: ${err.message}`);
    }
  }

  if (!productId) {
    return (
      <div className="section-card">
        <p className="info-message">Selecciona un producto para generar un lote</p>
      </div>
    );
  }

  return (
    <div className="section-card">
      <h2>Generar Lote de Handtags</h2>

      {result ? (
        <div className="batch-result">
          <div className="success-badge">✓ Lote generado exitosamente</div>
          <div className="result-details">
            <p><strong>ID Lote:</strong> {result.batchId}</p>
            <p><strong>Producto:</strong> {result.productName}</p>
            <p><strong>Cantidad:</strong> {result.quantity} códigos</p>
          </div>

          <h3>Descargas Disponibles</h3>
          <div className="download-list">
            {result.downloadFiles?.map(file => (
              <button
                key={file.name}
                className="download-item"
                onClick={() => handleDownload(file.downloadUrl)}
              >
                <span className="download-icon">⬇️</span>
                <span className="download-name">{file.name}</span>
                <span className="download-type">{file.type.toUpperCase()}</span>
              </button>
            ))}
          </div>

          <div className="codes-section">
            <h3>Códigos Generados</h3>
            <div className="codes-grid">
              {result.codes?.map(codeItem => (
                <div key={codeItem.code} className="code-card">
                  <div className="code-value">{codeItem.code}</div>
                  <a href={codeItem.qrUrl} target="_blank" rel="noopener noreferrer" className="qr-link">
                    Ver QR
                  </a>
                </div>
              ))}
            </div>
          </div>

          <button className="btn btn-secondary" onClick={() => setResult(null)}>
            Generar otro lote
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="batch-form">
          <div className="form-group">
            <label>Cantidad de Códigos</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={quantity}
              onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label>Notas (Opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Agregar notas sobre este lote..."
              disabled={loading}
              rows="3"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Generando...' : 'Generar Lote'}
          </button>
        </form>
      )}
    </div>
  );
}
