import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Administrator with full access' },
  });
  const managerRole = await prisma.role.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: { name: 'MANAGER', description: 'Manager with limited access' },
  });
  const staffRole = await prisma.role.upsert({
    where: { name: 'STAFF' },
    update: {},
    create: { name: 'STAFF', description: 'Staff with read access' },
  });

  console.log('Roles created:', { adminRole, managerRole, staffRole });

  // Permissions
  const resources = ['products', 'categories', 'suppliers', 'warehouses', 'inventory', 'transactions', 'users', 'audit-logs'];
  const actions = ['read', 'create', 'update', 'delete'];
  for (const resource of resources) {
    for (const action of actions) {
      await prisma.permission.upsert({
        where: { name: `${resource}:${action}` },
        update: {},
        create: {
          name: `${resource}:${action}`,
          resource,
          action,
          description: `${action} ${resource}`,
        },
      });
    }
  }
  console.log('Permissions created');

  // Admin User
  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@stockpilot.com' },
    update: {},
    create: {
      email: 'admin@stockpilot.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      roleId: adminRole.id,
      isActive: true,
    },
  });

  // Manager User
  const managerPassword = await bcrypt.hash('Manager@123', 10);
  await prisma.user.upsert({
    where: { email: 'manager@stockpilot.com' },
    update: {},
    create: {
      email: 'manager@stockpilot.com',
      password: managerPassword,
      firstName: 'John',
      lastName: 'Manager',
      roleId: managerRole.id,
      isActive: true,
    },
  });

  // Staff User
  const staffPassword = await bcrypt.hash('Staff@123', 10);
  await prisma.user.upsert({
    where: { email: 'staff@stockpilot.com' },
    update: {},
    create: {
      email: 'staff@stockpilot.com',
      password: staffPassword,
      firstName: 'Jane',
      lastName: 'Staff',
      roleId: staffRole.id,
      isActive: true,
    },
  });

  console.log('Users created');

  // Categories
  const categories = [
    { name: 'Electronics', description: 'Electronic devices and components' },
    { name: 'Office Supplies', description: 'Office and stationery items' },
    { name: 'Furniture', description: 'Office and home furniture' },
    { name: 'Clothing', description: 'Apparel and accessories' },
    { name: 'Food & Beverages', description: 'Consumable food items' },
  ];
  const createdCategories: any[] = [];
  for (const cat of categories) {
    const c = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    createdCategories.push(c);
  }
  console.log('Categories created');

  // Suppliers
  const suppliers = [
    {
      name: 'TechSupply Co.',
      email: 'contact@techsupply.com',
      phone: '+1-555-0101',
      address: '123 Tech Ave, Silicon Valley, CA',
    },
    {
      name: 'Office World',
      email: 'orders@officeworld.com',
      phone: '+1-555-0102',
      address: '456 Business Blvd, New York, NY',
    },
    {
      name: 'Global Imports',
      email: 'import@globalimports.com',
      phone: '+1-555-0103',
      address: '789 Trade St, Chicago, IL',
    },
  ];
  const createdSuppliers: any[] = [];
  for (const sup of suppliers) {
    const s = await prisma.supplier.upsert({
      where: { email: sup.email },
      update: {},
      create: sup,
    });
    createdSuppliers.push(s);
  }
  console.log('Suppliers created');

  // Warehouses
  const warehouses = [
    { name: 'Main Warehouse', location: 'New York, NY', description: 'Primary storage facility' },
    {
      name: 'West Coast Hub',
      location: 'Los Angeles, CA',
      description: 'West coast distribution center',
    },
    {
      name: 'Central Depot',
      location: 'Chicago, IL',
      description: 'Central US warehouse',
    },
  ];
  const createdWarehouses: any[] = [];
  for (const wh of warehouses) {
    let w = await prisma.warehouse.findFirst({ where: { name: wh.name } });
    if (!w) {
      w = await prisma.warehouse.create({ data: wh });
    }
    createdWarehouses.push(w);
  }
  console.log('Warehouses created');

  // Products
  const products = [
    {
      name: 'Laptop Pro 15"',
      sku: 'LAPTOP-PRO-15',
      price: 1299.99,
      costPrice: 899.99,
      unit: 'pcs',
      minStockLevel: 5,
      categoryId: createdCategories[0].id,
      supplierId: createdSuppliers[0].id,
    },
    {
      name: 'Wireless Mouse',
      sku: 'MOUSE-WIRELESS-01',
      price: 39.99,
      costPrice: 19.99,
      unit: 'pcs',
      minStockLevel: 20,
      categoryId: createdCategories[0].id,
      supplierId: createdSuppliers[0].id,
    },
    {
      name: 'Mechanical Keyboard',
      sku: 'KB-MECH-001',
      price: 149.99,
      costPrice: 79.99,
      unit: 'pcs',
      minStockLevel: 10,
      categoryId: createdCategories[0].id,
      supplierId: createdSuppliers[0].id,
    },
    {
      name: 'A4 Paper Ream',
      sku: 'PAPER-A4-500',
      price: 8.99,
      costPrice: 4.5,
      unit: 'ream',
      minStockLevel: 50,
      categoryId: createdCategories[1].id,
      supplierId: createdSuppliers[1].id,
    },
    {
      name: 'Ballpoint Pens (Box)',
      sku: 'PEN-BP-BOX12',
      price: 5.99,
      costPrice: 2.5,
      unit: 'box',
      minStockLevel: 30,
      categoryId: createdCategories[1].id,
      supplierId: createdSuppliers[1].id,
    },
    {
      name: 'Office Chair',
      sku: 'CHAIR-OFFICE-001',
      price: 299.99,
      costPrice: 149.99,
      unit: 'pcs',
      minStockLevel: 3,
      categoryId: createdCategories[2].id,
      supplierId: createdSuppliers[1].id,
    },
    {
      name: 'Standing Desk',
      sku: 'DESK-STAND-001',
      price: 599.99,
      costPrice: 349.99,
      unit: 'pcs',
      minStockLevel: 2,
      categoryId: createdCategories[2].id,
      supplierId: createdSuppliers[2].id,
    },
    {
      name: 'USB-C Hub',
      sku: 'USB-HUB-C7',
      price: 49.99,
      costPrice: 24.99,
      unit: 'pcs',
      minStockLevel: 15,
      categoryId: createdCategories[0].id,
      supplierId: createdSuppliers[0].id,
    },
  ];
  const createdProducts: any[] = [];
  for (const prod of products) {
    const p = await prisma.product.upsert({
      where: { sku: prod.sku },
      update: {},
      create: prod,
    });
    createdProducts.push(p);
  }
  console.log('Products created');

  // Inventory
  if (createdWarehouses.length > 0) {
    const inventoryData = [
      { productId: createdProducts[0].id, warehouseId: createdWarehouses[0].id, quantity: 25 },
      { productId: createdProducts[1].id, warehouseId: createdWarehouses[0].id, quantity: 100 },
      { productId: createdProducts[2].id, warehouseId: createdWarehouses[0].id, quantity: 45 },
      { productId: createdProducts[3].id, warehouseId: createdWarehouses[0].id, quantity: 200 },
      { productId: createdProducts[4].id, warehouseId: createdWarehouses[0].id, quantity: 80 },
      {
        productId: createdProducts[0].id,
        warehouseId: createdWarehouses[1]?.id || createdWarehouses[0].id,
        quantity: 10,
      },
      { productId: createdProducts[5].id, warehouseId: createdWarehouses[0].id, quantity: 4 },
      { productId: createdProducts[6].id, warehouseId: createdWarehouses[0].id, quantity: 2 },
      { productId: createdProducts[7].id, warehouseId: createdWarehouses[0].id, quantity: 3 },
    ];
    for (const inv of inventoryData) {
      await prisma.inventoryItem
        .upsert({
          where: {
            productId_warehouseId: {
              productId: inv.productId,
              warehouseId: inv.warehouseId,
            },
          },
          update: { quantity: inv.quantity },
          create: inv,
        })
        .catch(() => null);
    }
    console.log('Inventory seeded');
  }

  console.log('\n=== Seeding complete! ===');
  console.log('Admin login:   admin@stockpilot.com   / Admin@123');
  console.log('Manager login: manager@stockpilot.com / Manager@123');
  console.log('Staff login:   staff@stockpilot.com   / Staff@123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
