import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';

export function BatchList({ refreshTrigger }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedBatchId, setExpandedBatchId] = useState(null);
  const [batchFiles, setBatchFiles] = useState({});

  useEffect(() => {
    fetchBatches();
  }, [refreshTrigger]);

  async function fetchBatches() {
    try {
      setLoading(true);
      const data = await apiClient.getBatches();
      setBatches(data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleBatchExpand(batchId) {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
      return;
    }

    if (!batchFiles[batchId]) {
      try {
        const files = await apiClient.getBatchFiles(batchId);
        setBatchFiles(prev => ({ ...prev, [batchId]: files || [] }));
      } catch (err) {
        alert(`Error cargando archivos: ${err.message}`);
      }
    }
    setExpandedBatchId(batchId);
  }

  async function handleDownload(batchId, fileName) {
    try {
      const blob = await apiClient.downloadFile(batchId, fileName);
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

  if (loading) return <div className="section-card">Cargando lotes...</div>;

  return (
    <div className="section-card">
      <h2>Lotes Generados</h2>
      
      {error && <div className="error-message">{error}</div>}

      {batches.length === 0 ? (
        <p className="empty-message">No hay lotes generados aún</p>
      ) : (
        <div className="batches-list">
          {batches.map(batch => (
            <div key={batch.id} className="batch-item">
              <button
                className="batch-header"
                onClick={() => toggleBatchExpand(batch.id)}
              >
                <span className="batch-icon">
                  {expandedBatchId === batch.id ? '▼' : '▶'}
                </span>
                <div className="batch-info">
                  <span className="batch-product">{batch.product?.name || 'Producto desconocido'}</span>
                  <span className="batch-meta">
                    ID: {batch.id.substring(0, 8)}... | {batch.quantity} códigos | {batch.status}
                  </span>
                </div>
                <span className="batch-date">
                  {new Date(batch.createdAt).toLocaleDateString('es-ES')}
                </span>
              </button>

              {expandedBatchId === batch.id && (
                <div className="batch-content">
                  <div className="batch-details">
                    <p><strong>ID Completo:</strong> {batch.id}</p>
                    <p><strong>Estado:</strong> {batch.status}</p>
                    <p><strong>Notas:</strong> {batch.notes || 'N/A'}</p>
                    <p><strong>Creado:</strong> {new Date(batch.createdAt).toLocaleString('es-ES')}</p>
                  </div>

                  {batch.handtagCodes && batch.handtagCodes.length > 0 && (
                    <div className="codes-preview">
                      <h4>Primeros códigos ({batch.handtagCodes.length} total)</h4>
                      <div className="codes-grid-small">
                        {batch.handtagCodes.slice(0, 5).map(code => (
                          <div key={code.id} className="code-badge">
                            {code.code}
                          </div>
                        ))}
                        {batch.handtagCodes.length > 5 && (
                          <div className="code-badge muted">
                            +{batch.handtagCodes.length - 5}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {batchFiles[batch.id] && (
                    <div className="files-section">
                      <h4>Archivos Disponibles</h4>
                      <div className="files-list">
                        {batchFiles[batch.id].map(file => (
                          <button
                            key={file.name}
                            className="file-item"
                            onClick={() => handleDownload(batch.id, file.name)}
                          >
                            <span>📥 {file.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-secondary" onClick={fetchBatches}>
        🔄 Refrescar
      </button>
    </div>
  );
}
