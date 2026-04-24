import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
  IsPositive,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaleItemDto {
  @ApiProperty() @IsString() productId: string;
  @ApiProperty() @IsNumber() @IsPositive() quantity: number;
  @ApiProperty() @IsNumber() @Min(0) unitPrice: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) discount?: number;
}

export class CreateSaleDto {
  @ApiProperty() @IsString() warehouseId: string;

  @ApiPropertyOptional() @IsOptional() @IsString() customerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerPhone?: string;

  @ApiProperty({ type: [SaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @ApiPropertyOptional({ enum: ['CASH', 'CARD', 'GCASH', 'TRANSFER'] })
  @IsOptional()
  @IsEnum(['CASH', 'CARD', 'GCASH', 'TRANSFER'])
  paymentMethod?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) taxRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
