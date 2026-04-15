import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class WarehousesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: dto });
  }

  async findAll(query: PaginationDto) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) where.name = { contains: search, mode: 'insensitive' };
    const [data, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        include: { _count: { select: { inventoryItems: true } } },
      }),
      this.prisma.warehouse.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const w = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        inventoryItems: {
          include: {
            product: { include: { category: true } },
          },
        },
      },
    });
    if (!w) throw new NotFoundException(`Warehouse ${id} not found`);
    return w;
  }

  async update(id: string, dto: UpdateWarehouseDto) {
    await this.findOne(id);
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.warehouse.update({ where: { id }, data: { isActive: false } });
    return { message: 'Warehouse deactivated' };
  }
}
