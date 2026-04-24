import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AdminAttendanceController } from './admin-attendance.controller';
import { AttendanceService } from './attendance.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [AttendanceController, AdminAttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
