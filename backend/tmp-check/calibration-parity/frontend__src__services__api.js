const API_BASE_URL = 'http://localhost:4000/api';
const BACKEND_BASE_URL = 'http://localhost:4000';

function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
}

export const apiClient = {
  // Templates
  async getTemplateConfig() {
    const response = await fetchWithTimeout(`${API_BASE_URL}/templates`);
    if (!response.ok) throw new Error('Failed to fetch template config');
    return response.json();
  },

  async saveTemplateConfig({ frontTemplate, backTemplate }) {
    const response = await fetchWithTimeout(`${API_BASE_URL}/templates`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frontTemplate, backTemplate }),
    });
    if (!response.ok) throw new Error('Failed to save template config');
    return response.json();
  },

  getActiveFrontTemplateUrl(cacheBuster = Date.now()) {
    return `${API_BASE_URL}/templates/front/active?t=${encodeURIComponent(String(cacheBuster))}`;
  },

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
  async generateBatch(productId, quantity, notes, printConfig = null) {
    const response = await fetch(`${API_BASE_URL}/handtags/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity, notes, ...(printConfig ? { printConfig } : {}) }),
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

  async generateCalibrationPreview(printConfig) {
    console.log('[Trace][api.js] qrPlacement antes de POST /calibration/preview:', printConfig?.qrPlacement);
    const response = await fetchWithTimeout(`${API_BASE_URL}/calibration/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printConfig }),
    });
    if (!response.ok) throw new Error('Failed to generate calibration preview');
    return response.json();
  },

  async downloadPreviewFile(downloadUrl) {
    const url = downloadUrl.startsWith('http') ? downloadUrl : `${BACKEND_BASE_URL}${downloadUrl}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error('Failed to download preview file');
    return response.blob();
  },
};
