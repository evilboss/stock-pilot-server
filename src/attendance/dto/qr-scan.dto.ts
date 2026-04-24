import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AttendanceEventType } from '../enums/attendance-event-type.enum';

export class QrScanDto {
  @ApiProperty()
  @IsString()
  terminalCode: string;

  @ApiProperty({ enum: AttendanceEventType })
  @IsEnum(AttendanceEventType)
  action: AttendanceEventType;
}
