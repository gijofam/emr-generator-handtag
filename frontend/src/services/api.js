const API_BASE_URL = 'http://localhost:4000/api';

export const apiClient = {
  // Products
  async getProducts() {
    const response = await fetch(`${API_BASE_URL}/handtags/products`);
    if (!response.ok) throw new Error('Failed to fetch products');
    return response.json();
  },

  async createProduct(name, prefix) {
    const response = await fetch(`${API_BASE_URL}/handtags/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, prefix }),
    });
    if (!response.ok) throw new Error('Failed to create product');
    return response.json();
  },

  // Batches
  async generateBatch(productId, quantity, notes) {
    const response = await fetch(`${API_BASE_URL}/handtags/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity, notes }),
    });
    if (!response.ok) throw new Error('Failed to generate batch');
    return response.json();
  },

  async getBatches() {
    const response = await fetch(`${API_BASE_URL}/batches`);
    if (!response.ok) throw new Error('Failed to fetch batches');
    return response.json();
  },

  async getBatchFiles(batchId) {
    const response = await fetch(`${API_BASE_URL}/batches/${batchId}/files`);
    if (!response.ok) throw new Error('Failed to fetch batch files');
    return response.json();
  },

  async downloadFile(batchId, fileName) {
    const encodedFileName = encodeURIComponent(fileName);
    const response = await fetch(`${API_BASE_URL}/batches/${batchId}/download/${encodedFileName}`);
    if (!response.ok) throw new Error('Failed to download file');
    return response.blob();
  },
};
