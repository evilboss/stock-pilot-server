import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AttendanceService } from './attendance.service';
import { AttendanceActionDto } from './dto/attendance-action.dto';
import { QrScanDto } from './dto/qr-scan.dto';
import { KioskScanDto } from './dto/kiosk-scan.dto';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';
import { Request } from 'express';

@ApiTags('Attendance (Employee)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Get('me/today')
  @ApiOperation({ summary: "Get today's attendance status and available next actions" })
  getToday(@CurrentUser('sub') userId: string) {
    return this.service.getToday(userId);
  }

  @Get('me/history')
  @ApiOperation({ summary: 'Get employee attendance history' })
  getHistory(
    @CurrentUser('sub') userId: string,
    @Query() filter: AttendanceFilterDto,
  ) {
    return this.service.getHistory(userId, filter);
  }

  @Get('me/qr')
  @ApiOperation({ summary: 'Generate opaque QR token for kiosk scanning (employee My QR)' })
  getMyQr(@CurrentUser('sub') userId: string) {
    return this.service.generateEmployeeQrToken(userId);
  }

  @Post('me/action')
  @ApiOperation({ summary: 'Submit a manual attendance action (clock in/out, lunch)' })
  performAction(
    @CurrentUser('sub') userId: string,
    @Body() dto: AttendanceActionDto,
    @Req() req: Request,
  ) {
    return this.service.performManualAction(userId, dto, req.ip, req.headers['user-agent'] as string);
  }

  @Post('me/qr-scan')
  @ApiOperation({ summary: 'Submit attendance via QR code scan (employee-initiated, explicit action)' })
  qrScan(
    @CurrentUser('sub') userId: string,
    @Body() dto: QrScanDto,
    @Req() req: Request,
  ) {
    return this.service.performQrScan(userId, dto, req.ip, req.headers['user-agent'] as string);
  }

  // ── Kiosk (no auth — QR token is the credential) ─────────────────────────

  @Public()
  @Post('kiosk/scan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kiosk smart scan — auto-determines CLOCK_IN vs CLOCK_OUT from token',
    description: 'No bearer auth. The qrToken (from GET /attendance/me/qr) is the credential.',
  })
  kioskScan(@Body() dto: KioskScanDto, @Req() req: Request) {
    return this.service.performKioskScan(
      dto,
      req.ip,
      req.headers['user-agent'] as string,
    );
  }
}
