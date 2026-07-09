const batchService = require('../services/batchService');

class BatchController {
  async listBatches(req, res, next) {
    try {
      const batches = await batchService.listBatches();
      res.json(batches);
    } catch (error) {
      next(error);
    }
  }

  async getBatch(req, res, next) {
    try {
      const batch = await batchService.getBatch(req.params.id);
      if (!batch) {
        return res.status(404).json({ message: 'Lote no encontrado.' });
      }
      res.json(batch);
    } catch (error) {
      next(error);
    }
  }

  async listFiles(req, res, next) {
    try {
      const files = await batchService.listBatchFiles(req.params.id);
      res.json(files.map((item) => ({
        name: item.file,
        downloadUrl: `/api/batches/${req.params.id}/download/${encodeURIComponent(item.file)}`,
      })));
    } catch (error) {
      next(error);
    }
  }

  async downloadFile(req, res, next) {
    try {
      const filePath = await batchService.getBatchFilePath(req.params.id, req.params.fileName);
      res.download(filePath);
    } catch (error) {
      if (error.message === 'Archivo no encontrado.') {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  }
}

module.exports = new BatchController();
