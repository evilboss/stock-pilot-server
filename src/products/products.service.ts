import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const exists = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (exists) throw new ConflictException('SKU already exists');
    return this.prisma.product.create({
      data: dto,
      include: { category: true, supplier: true },
    });
  }

  async findAll(query: PaginationDto & { categoryId?: string; supplierId?: string; lowStock?: boolean }) {
    const { page = 1, limit = 10, search, categoryId, supplierId } = query;
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (supplierId) where.supplierId = supplierId;
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: true,
          supplier: true,
          inventoryItems: { include: { warehouse: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        supplier: true,
        inventoryItems: { include: { warehouse: true } },
      },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: dto,
      include: { category: true, supplier: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
    return { message: 'Product deactivated successfully' };
  }

  async getLowStockProducts() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: { inventoryItems: true, category: true },
    });
    return products.filter(p => {
      const totalQty = p.inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
      return totalQty <= p.minStockLevel;
    });
  }
}
