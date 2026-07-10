const productRepository = require('../repositories/productRepository');
const batchService = require('./batchService');

class HandtagService {
  async createProduct({ name, prefix }) {
    const existingProduct = await productRepository.findByPrefix(prefix);
    if (existingProduct) {
      throw new Error('El prefijo ya está en uso.');
    }

    return productRepository.create({ name, prefix });
  }

  async listProducts() {
    return productRepository.listProducts();
  }

  async generateBatch(payload) {
    return batchService.generateBatch(payload);
  }
}

module.exports = new HandtagService();
