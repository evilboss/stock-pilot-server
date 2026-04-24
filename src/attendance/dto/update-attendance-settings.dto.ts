import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceMethod } from '../enums/attendance-method.enum';

export class UpdateAttendanceSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableManualAttendance?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableQrAttendance?: boolean;

  @ApiPropertyOptional({ enum: AttendanceMethod })
  @IsOptional()
  @IsEnum(AttendanceMethod)
  defaultMethod?: AttendanceMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableLunchTracking?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireLunchTracking?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  actionCooldownSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;
}
