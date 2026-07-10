const fs = require('fs');
const path = require('path');
const batchRepository = require('../repositories/batchRepository');
const handtagRepository = require('../repositories/handtagRepository');
const productRepository = require('../repositories/productRepository');
const qrService = require('./qrService');
const pdfService = require('./pdfService');
const appConfig = require('../config/app');

class BatchService {
  async generateBatch({ productId, quantity, notes, printConfig }) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new Error('Producto no encontrado.');
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('La cantidad debe ser un entero mayor a cero.');
    }

    const batch = await handtagRepository.createBatch(productId, quantity, notes);
    await handtagRepository.updateBatchStatus(batch.id, 'GENERATING');

    const codes = [];
    const csvRows = [];
    const outputDir = path.join(appConfig.outputDir, batch.id);
    fs.mkdirSync(outputDir, { recursive: true });

    for (let index = 0; index < quantity; index += 1) {
      const code = await this.createUniqueCode(product.prefix);
      const qrUrl = `${appConfig.qrBaseUrl}/${code}`;
      const qrPath = path.join(outputDir, `${code}.png`);
      await qrService.generateQrFile(qrPath, qrUrl);

      codes.push({
        batchId: batch.id,
        productId,
        code,
        qrUrl,
        status: 'GENERATED',
      });

      csvRows.push([code, qrUrl]);
    }

    await handtagRepository.createCodes(codes);
    const pdfFileName = await pdfService.createPdfBundle(outputDir, csvRows, product, batch.id, printConfig);
    const csvFileName = `${product.prefix}_${batch.id}.csv`;
    await handtagRepository.updateBatchStatus(batch.id, 'COMPLETED', new Date());

    return {
      batchId: batch.id,
      productName: product.name,
      quantity,
      downloadFiles: [
        {
          name: pdfFileName,
          type: 'pdf',
          downloadUrl: `/api/batches/${batch.id}/download/${encodeURIComponent(pdfFileName)}`,
        },
        {
          name: csvFileName,
          type: 'csv',
          downloadUrl: `/api/batches/${batch.id}/download/${encodeURIComponent(csvFileName)}`,
        },
      ],
      codes: codes.map(({ code }) => ({
        code,
        qrUrl: `${appConfig.qrBaseUrl}/${code}`,
      })),
    };
  }

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

  async createUniqueCode(prefix) {
    const seen = new Set();
    while (true) {
      const candidate = this.makeCode(prefix);
      if (seen.has(candidate)) {
        continue;
      }
      seen.add(candidate);
      const exists = await handtagRepository.codeExists(candidate);
      if (!exists) {
        return candidate;
      }
    }
  }

  makeCode(prefix) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const segment = [];
    for (let i = 0; i < 6; i += 1) {
      const set = i % 2 === 0 ? letters : numbers;
      segment.push(set[Math.floor(Math.random() * set.length)]);
    }
    return `${prefix}-${segment.join('')}`;
  }
}

module.exports = new BatchService();
