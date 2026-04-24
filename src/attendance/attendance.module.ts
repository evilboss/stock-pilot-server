import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AttendanceController } from './attendance.controller';
import { AdminAttendanceController } from './admin-attendance.controller';
import { AttendanceService } from './attendance.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    AuditLogsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (cs: ConfigService) => ({ secret: cs.get('JWT_SECRET') }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AttendanceController, AdminAttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
