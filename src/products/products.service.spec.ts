import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: any;

  const mockProduct = {
    id: 'prod-1',
    name: 'Test Product',
    sku: 'TEST-001',
    price: 99.99,
    costPrice: 50.0,
    categoryId: 'cat-1',
    isActive: true,
    category: { name: 'Electronics' },
    supplier: null,
    inventoryItems: [],
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([mockProduct]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue(mockProduct),
        update: jest.fn().mockResolvedValue(mockProduct),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('findAll returns paginated data', async () => {
    const result = await service.findAll({ page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('findOne throws NotFoundException when not found', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('create throws ConflictException for duplicate SKU', async () => {
    prisma.product.findUnique.mockResolvedValue(mockProduct);
    await expect(
      service.create({ name: 'X', sku: 'TEST-001', price: 1, costPrice: 1, categoryId: 'cat-1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('create a product successfully when SKU is unique', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    const result = await service.create({
      name: 'New Product',
      sku: 'NEW-001',
      price: 50,
      costPrice: 25,
      categoryId: 'cat-1',
    });
    expect(result).toEqual(mockProduct);
    expect(prisma.product.create).toHaveBeenCalled();
  });

  it('remove deactivates the product', async () => {
    prisma.product.findUnique.mockResolvedValue(mockProduct);
    const result = await service.remove('prod-1');
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { isActive: false },
    });
    expect(result.message).toBe('Product deactivated successfully');
  });
});
