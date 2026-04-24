import { IsString, IsOptional, IsBoolean, IsDateString, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceEventType } from '../enums/attendance-event-type.enum';

export class CreateQrTerminalDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ type: [String], enum: AttendanceEventType })
  @IsOptional()
  @IsArray()
  @IsEnum(AttendanceEventType, { each: true })
  allowedActions?: AttendanceEventType[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
