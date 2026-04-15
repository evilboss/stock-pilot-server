import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { warehouseId?: string; productId?: string }) {
    const { page = 1, limit = 10, warehouseId, productId } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (warehouseId) where.warehouseId = warehouseId;
    if (productId) where.productId = productId;
    const [data, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: { include: { category: true } },
          warehouse: true,
        },
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getInventorySummary() {
    const items = await this.prisma.inventoryItem.findMany({
      include: { product: true, warehouse: true },
    });
    const totalProducts = await this.prisma.product.count({ where: { isActive: true } });
    const totalWarehouses = await this.prisma.warehouse.count({ where: { isActive: true } });
    const totalValue = items.reduce(
      (sum, item) => sum + Number(item.product.costPrice) * item.quantity,
      0,
    );
    const lowStockItems = items.filter(item => item.quantity <= item.product.minStockLevel);
    return {
      totalProducts,
      totalWarehouses,
      totalInventoryItems: items.length,
      totalInventoryValue: totalValue,
      lowStockCount: lowStockItems.length,
    };
  }

  async adjustInventory(productId: string, warehouseId: string, quantity: number, notes?: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });
    if (!item && quantity < 0) throw new BadRequestException('Cannot have negative inventory');
    if (item && item.quantity + quantity < 0) throw new BadRequestException('Insufficient stock');

    const inventoryItem = await this.prisma.inventoryItem.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      update: { quantity: { increment: quantity } },
      create: { productId, warehouseId, quantity: Math.max(0, quantity) },
      include: { product: true, warehouse: true },
    });

    await this.prisma.stockTransaction.create({
      data: {
        type: quantity > 0 ? 'STOCK_IN' : 'STOCK_OUT',
        quantity: Math.abs(quantity),
        notes,
        productId,
        warehouseId,
      },
    });

    return inventoryItem;
  }
}
