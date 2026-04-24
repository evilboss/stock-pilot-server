import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KioskScanDto {
  @ApiProperty({ description: 'Opaque QR token from employee My QR view' })
  @IsString()
  qrToken: string;

  @ApiPropertyOptional({ description: 'Kiosk or terminal identifier for audit' })
  @IsOptional()
  @IsString()
  kioskId?: string;

  @ApiPropertyOptional({ description: 'Physical location label for audit' })
  @IsOptional()
  @IsString()
  locationId?: string;
}
