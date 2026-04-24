import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  private async generateInvoiceNo(): Promise<string> {
    const today = new Date();
    const prefix = `INV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const count = await this.prisma.sale.count({
      where: { invoiceNo: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateSaleDto, soldById?: string) {
    if (!dto.items?.length) throw new BadRequestException('Sale must have at least one item');

    // Validate stock availability
    for (const item of dto.items) {
      const inventory = await this.prisma.inventoryItem.findUnique({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: dto.warehouseId } },
      });
      if (!inventory || inventory.quantity < item.quantity) {
        const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
        throw new BadRequestException(
          `Insufficient stock for "${product?.name ?? item.productId}". Available: ${inventory?.quantity ?? 0}`,
        );
      }
    }

    const taxRate = dto.taxRate ?? 0;
    const lineItems = dto.items.map((item) => {
      const lineDiscount = Number(item.discount ?? 0);
      const lineTotal = item.quantity * item.unitPrice - lineDiscount;
      return { ...item, discount: lineDiscount, total: lineTotal };
    });

    const subtotal = lineItems.reduce((s, i) => s + i.total, 0);
    const discountAmount = Number(dto.discountAmount ?? 0);
    const taxAmount = (subtotal - discountAmount) * (taxRate / 100);
    const total = subtotal - discountAmount + taxAmount;

    const invoiceNo = await this.generateInvoiceNo();

    const sale = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          invoiceNo,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          warehouseId: dto.warehouseId,
          subtotal,
          discountAmount,
          taxAmount,
          total,
          paymentMethod: (dto.paymentMethod as any) ?? 'CASH',
          notes: dto.notes,
          soldById,
          items: {
            create: lineItems.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discount: i.discount,
              total: i.total,
            })),
          },
        },
        include: { items: { include: { product: true } }, warehouse: true },
      });

      // Deduct inventory and record stock-out transactions
      for (const item of lineItems) {
        await tx.inventoryItem.update({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: dto.warehouseId } },
          data: { quantity: { decrement: item.quantity } },
        });
        await tx.stockTransaction.create({
          data: {
            type: 'STOCK_OUT',
            productId: item.productId,
            warehouseId: dto.warehouseId,
            quantity: item.quantity,
            reference: invoiceNo,
            notes: `Sale: ${invoiceNo}`,
            performedById: soldById,
          },
        });
      }

      return created;
    });

    return sale;
  }

  async findAll(query: PaginationDto & { status?: string; warehouseId?: string }) {
    const { page = 1, limit = 10, status, warehouseId } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (warehouseId) where.warehouseId = warehouseId;

    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip,
        take: Number(limit),
        include: { items: { include: { product: true } }, warehouse: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sale.count({ where }),
    ]);
    return { data, meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } };
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, warehouse: true },
    });
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    return sale;
  }

  async voidSale(id: string) {
    const sale = await this.findOne(id);
    if (sale.status !== 'COMPLETED') {
      throw new BadRequestException('Only completed sales can be voided');
    }

    return this.prisma.$transaction(async (tx) => {
      // Restore inventory
      for (const item of sale.items) {
        await tx.inventoryItem.update({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: sale.warehouseId } },
          data: { quantity: { increment: item.quantity } },
        });
      }
      return tx.sale.update({ where: { id }, data: { status: 'VOID' } });
    });
  }
}
