import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private service: SuppliersService) {}

  @Post()
  @ApiOperation({ summary: 'Create supplier' })
  create(@Body() dto: CreateSupplierDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all suppliers' })
  findAll(@Query() q: PaginationDto) {
    return this.service.findAll(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get supplier by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update supplier' })
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate supplier' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
