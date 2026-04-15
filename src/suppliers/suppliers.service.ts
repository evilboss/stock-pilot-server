import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSupplierDto) {
    if (dto.email) {
      const exists = await this.prisma.supplier.findUnique({ where: { email: dto.email } });
      if (exists) throw new ConflictException('Supplier email already exists');
    }
    return this.prisma.supplier.create({ data: dto });
  }

  async findAll(query: PaginationDto) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const s = await this.prisma.supplier.findUnique({
      where: { id },
      include: { products: true },
    });
    if (!s) throw new NotFoundException(`Supplier ${id} not found`);
    return s;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.supplier.update({ where: { id }, data: { isActive: false } });
    return { message: 'Supplier deactivated' };
  }
}
