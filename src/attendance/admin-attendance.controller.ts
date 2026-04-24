import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AttendanceService } from './attendance.service';
import { CorrectAttendanceDto } from './dto/correct-attendance.dto';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';
import { CreateQrTerminalDto } from './dto/create-qr-terminal.dto';
import { UpdateAttendanceSettingsDto } from './dto/update-attendance-settings.dto';

@ApiTags('Attendance (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/attendance')
export class AdminAttendanceController {
  constructor(private readonly service: AttendanceService) {}

  // Settings

  @Get('settings')
  @Roles('admin')
  @ApiOperation({ summary: 'Get company attendance settings' })
  getSettings() {
    return this.service.getSettings();
  }

  @Patch('settings')
  @Roles('admin')
  @ApiOperation({ summary: 'Update company attendance settings' })
  updateSettings(
    @Body() dto: UpdateAttendanceSettingsDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.service.updateSettings(dto, actorId);
  }

  // Employee flags

  @Get('users/:userId/flags')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Get employee attendance flags' })
  getFlags(@Param('userId') userId: string) {
    return this.service.getEmployeeFlags(userId);
  }

  @Patch('users/:userId/flags')
  @Roles('admin')
  @ApiOperation({ summary: 'Set employee attendance override flags' })
  upsertFlags(
    @Param('userId') userId: string,
    @Body() body: { allowManualOverride?: boolean | null; allowQrOverride?: boolean | null; enableLunchOverride?: boolean | null },
    @CurrentUser('sub') actorId: string,
  ) {
    return this.service.upsertEmployeeFlags(userId, body, actorId);
  }

  // Timesheet list (Issue #14)

  @Get('timesheet')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'List all attendance records (timesheet log)' })
  listAll(@Query() filter: AttendanceFilterDto) {
    return this.service.listAll(filter);
  }

  // Correction (Issue #12)

  @Patch('records/:recordId/correct')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Admin/manager correction with mandatory reason' })
  correct(
    @Param('recordId') recordId: string,
    @Body() dto: CorrectAttendanceDto,
    @CurrentUser('sub') editorId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.correctAttendance(recordId, dto, editorId, user?.role?.name ?? '');
  }

  // QR terminals (Issue #6)

  @Get('qr-terminals')
  @Roles('admin')
  @ApiOperation({ summary: 'List all QR terminals' })
  listTerminals() {
    return this.service.listQrTerminals();
  }

  @Post('qr-terminals')
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new QR terminal' })
  createTerminal(
    @Body() dto: CreateQrTerminalDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.service.createQrTerminal(dto, actorId);
  }

  @Patch('qr-terminals/:id/activate')
  @Roles('admin')
  @ApiOperation({ summary: 'Activate a QR terminal' })
  activate(@Param('id') id: string, @CurrentUser('sub') actorId: string) {
    return this.service.toggleQrTerminal(id, true, actorId);
  }

  @Patch('qr-terminals/:id/deactivate')
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate a QR terminal' })
  deactivate(@Param('id') id: string, @CurrentUser('sub') actorId: string) {
    return this.service.toggleQrTerminal(id, false, actorId);
  }
}
