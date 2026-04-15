import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  sku: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice: number;

  @ApiPropertyOptional({ default: 'pcs' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minStockLevel?: number;

  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
