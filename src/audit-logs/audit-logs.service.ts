import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    action: string;
    resource: string;
    resourceId?: string;
    oldValues?: any;
    newValues?: any;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({ data });
  }

  async findAll(query: PaginationDto & { userId?: string; resource?: string }) {
    const { page = 1, limit = 10, userId, resource } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (userId) where.userId = userId;
    if (resource) where.resource = resource;
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data: logs, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
