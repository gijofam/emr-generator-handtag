const fs = require('fs');
const path = require('path');
const batchRepository = require('../repositories/batchRepository');
const appConfig = require('../config/app');

class BatchService {
  async listBatches() {
    return batchRepository.listBatches();
  }

  async getBatch(id) {
    return batchRepository.findBatchById(id);
  }

  async listBatchFiles(batchId) {
    const batchDir = path.join(appConfig.outputDir, batchId);
    if (!fs.existsSync(batchDir)) {
      return [];
    }

    return fs.readdirSync(batchDir).map((file) => ({
      file,
      path: path.join(batchDir, file),
    }));
  }

  async getBatchFilePath(batchId, fileName) {
    const batchDir = path.join(appConfig.outputDir, batchId);
    const normalized = path.normalize(fileName);
    if (normalized !== fileName || normalized.includes('..')) {
      throw new Error('Nombre de archivo inválido.');
    }

    const fullPath = path.join(batchDir, fileName);
    if (!fullPath.startsWith(batchDir)) {
      throw new Error('Nombre de archivo inválido.');
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error('Archivo no encontrado.');
    }

    return fullPath;
  }
}

module.exports = new BatchService();
