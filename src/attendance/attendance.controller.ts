import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AttendanceService } from './attendance.service';
import { AttendanceActionDto } from './dto/attendance-action.dto';
import { QrScanDto } from './dto/qr-scan.dto';
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

  @Post('me/action')
  @ApiOperation({ summary: 'Submit a manual attendance action (clock in/out, lunch)' })
  performAction(
    @CurrentUser('sub') userId: string,
    @Body() dto: AttendanceActionDto,
    @Req() req: Request,
  ) {
    const ip = req.ip;
    const device = req.headers['user-agent'];
    return this.service.performManualAction(userId, dto, ip, device);
  }

  @Post('me/qr-scan')
  @ApiOperation({ summary: 'Submit attendance via QR code scan' })
  qrScan(
    @CurrentUser('sub') userId: string,
    @Body() dto: QrScanDto,
    @Req() req: Request,
  ) {
    const ip = req.ip;
    const device = req.headers['user-agent'];
    return this.service.performQrScan(userId, dto, ip, device);
  }
}
