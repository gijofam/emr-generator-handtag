import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';

export function ProductList({ onProductSelect, selectedProductId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', prefix: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      setLoading(true);
      const data = await apiClient.getProducts();
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProduct(e) {
    e.preventDefault();
    if (!formData.name || !formData.prefix) {
      alert('Por favor completa todos los campos');
      return;
    }

    try {
      setCreating(true);
      const newProduct = await apiClient.createProduct(formData.name, formData.prefix);
      setProducts([...products, newProduct]);
      setFormData({ name: '', prefix: '' });
      setShowForm(false);
      if (!selectedProductId) {
        onProductSelect(newProduct.id);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="section-card">Cargando productos...</div>;

  return (
    <div className="section-card">
      <h2>Productos</h2>
      
      {error && <div className="error-message">{error}</div>}

      <div className="product-list">
        {products.length === 0 ? (
          <p className="empty-message">No hay productos aún</p>
        ) : (
          products.map(product => (
            <button
              key={product.id}
              className={`product-item ${selectedProductId === product.id ? 'selected' : ''}`}
              onClick={() => onProductSelect(product.id)}
            >
              <span className="product-name">{product.name}</span>
              <span className="product-prefix">{product.prefix}</span>
            </button>
          ))
        )}
      </div>

      {!showForm ? (
        <button className="btn btn-secondary" onClick={() => setShowForm(true)}>
          + Nuevo Producto
        </button>
      ) : (
        <form onSubmit={handleCreateProduct} className="product-form">
          <input
            type="text"
            placeholder="Nombre del producto"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            disabled={creating}
          />
          <input
            type="text"
            placeholder="Prefijo (ej: MC)"
            value={formData.prefix}
            onChange={e => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })}
            maxLength="3"
            disabled={creating}
          />
          <div className="form-buttons">
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creando...' : 'Crear'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowForm(false)}
              disabled={creating}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
