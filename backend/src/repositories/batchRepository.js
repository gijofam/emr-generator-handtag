const prisma = require('../config/prisma');

class BatchRepository {
  async listBatches() {
    return prisma.handtagBatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { product: true, handtagCodes: true },
    });
  }

  async findBatchById(id) {
    return prisma.handtagBatch.findUnique({
      where: { id },
      include: { product: true, handtagCodes: true },
    });
  }
}

module.exports = new BatchRepository();
