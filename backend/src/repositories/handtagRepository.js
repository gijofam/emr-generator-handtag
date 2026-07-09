const prisma = require('../config/prisma');

class HandtagRepository {
  async createBatch(productId, quantity, notes) {
    return prisma.handtagBatch.create({
      data: {
        productId,
        quantity,
        status: 'PENDING',
        notes,
      },
    });
  }

  async updateBatchStatus(id, status, generatedAt = null) {
    return prisma.handtagBatch.update({
      where: { id },
      data: {
        status,
        generatedAt: generatedAt ?? undefined,
      },
    });
  }

  async codeExists(code) {
    const existing = await prisma.handtagCode.findUnique({
      where: { code },
      select: { id: true },
    });
    return Boolean(existing);
  }

  async createCodes(codes) {
    return prisma.handtagCode.createMany({
      data: codes,
      skipDuplicates: false,
    });
  }

  async findBatchById(id) {
    return prisma.handtagBatch.findUnique({
      where: { id },
      include: {
        product: true,
        handtagCodes: true,
      },
    });
  }
}

module.exports = new HandtagRepository();
