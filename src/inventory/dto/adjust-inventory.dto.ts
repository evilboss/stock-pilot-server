import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsInt, IsOptional, IsString } from 'class-validator';

export class AdjustInventoryDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsUUID()
  warehouseId: string;

  @ApiProperty({ description: 'Positive for stock in, negative for stock out' })
  @IsInt()
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
