import { IsEnum, IsString, IsDateString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AttendanceEventType } from '../enums/attendance-event-type.enum';

export class CorrectAttendanceDto {
  @ApiProperty({ description: 'Mandatory correction reason' })
  @IsString()
  @MinLength(5)
  reason: string;

  @ApiProperty({ enum: AttendanceEventType })
  @IsEnum(AttendanceEventType)
  action: AttendanceEventType;

  @ApiProperty({ description: 'Corrected timestamp (ISO 8601)' })
  @IsDateString()
  occurredAt: string;
}
