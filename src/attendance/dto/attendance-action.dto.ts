import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AttendanceEventType } from '../enums/attendance-event-type.enum';

export class AttendanceActionDto {
  @ApiProperty({ enum: AttendanceEventType })
  @IsEnum(AttendanceEventType)
  action: AttendanceEventType;
}
