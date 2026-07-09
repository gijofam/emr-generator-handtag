const handtagService = require('../services/handtagService');

class HandtagController {
  async createProduct(req, res, next) {
    try {
      const product = await handtagService.createProduct(req.body);
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  }

  async listProducts(req, res, next) {
    try {
      const products = await handtagService.listProducts();
      res.json(products);
    } catch (error) {
      next(error);
    }
  }

  async generateBatch(req, res, next) {
    try {
      const result = await handtagService.generateBatch(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new HandtagController();
