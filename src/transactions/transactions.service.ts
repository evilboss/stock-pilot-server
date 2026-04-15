import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTransactionDto, userId?: string) {
    const transaction = await this.prisma.stockTransaction.create({
      data: { ...dto, performedById: userId },
      include: { product: true, warehouse: true },
    });

    // Update inventory based on transaction type
    const quantity =
      dto.type === 'STOCK_IN' || dto.type === 'RETURN' ? dto.quantity : -dto.quantity;

    if (dto.type !== 'ADJUSTMENT') {
      await this.prisma.inventoryItem.upsert({
        where: {
          productId_warehouseId: { productId: dto.productId, warehouseId: dto.warehouseId },
        },
        update: { quantity: { increment: quantity } },
        create: {
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          quantity: Math.max(0, quantity),
        },
      });
    }

    return transaction;
  }

  async findAll(
    query: PaginationDto & { productId?: string; warehouseId?: string; type?: string },
  ) {
    const { page = 1, limit = 10, productId, warehouseId, type } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (productId) where.productId = productId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (type) where.type = type;
    const [data, total] = await Promise.all([
      this.prisma.stockTransaction.findMany({
        where,
        skip,
        take: limit,
        include: { product: true, warehouse: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockTransaction.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const t = await this.prisma.stockTransaction.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    });
    if (!t) throw new NotFoundException(`Transaction ${id} not found`);
    return t;
  }
}
