import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private service: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get inventory list' })
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get inventory summary/dashboard stats' })
  getSummary() {
    return this.service.getInventorySummary();
  }

  @Post('adjust')
  @ApiOperation({ summary: 'Adjust inventory quantity' })
  adjust(@Body() dto: AdjustInventoryDto) {
    return this.service.adjustInventory(dto.productId, dto.warehouseId, dto.quantity, dto.notes);
  }
}
