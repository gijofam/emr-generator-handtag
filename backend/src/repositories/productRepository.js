const prisma = require('../config/prisma');

class ProductRepository {
  async listProducts() {
    return prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { handtagBatches: true } } },
    });
  }

  async findById(id) {
    return prisma.product.findUnique({ where: { id } });
  }

  async findByPrefix(prefix) {
    return prisma.product.findUnique({ where: { prefix } });
  }

  async create(data) {
    return prisma.product.create({ data });
  }
}

module.exports = new ProductRepository();
