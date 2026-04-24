import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AttendanceEventType } from './enums/attendance-event-type.enum';
import { AttendanceMethod } from './enums/attendance-method.enum';
import { AttendanceRecordStatus } from './enums/attendance-status.enum';
import { AttendanceStateMachine } from './state-machine/attendance-state-machine';
import { AttendanceMethodResolver } from './resolvers/attendance-method-resolver';
import { AttendanceCalculator } from './calculators/attendance-calculator';
import { AttendanceActionDto } from './dto/attendance-action.dto';
import { QrScanDto } from './dto/qr-scan.dto';
import { CorrectAttendanceDto } from './dto/correct-attendance.dto';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';
import { UpdateAttendanceSettingsDto } from './dto/update-attendance-settings.dto';
import { CreateQrTerminalDto } from './dto/create-qr-terminal.dto';

const RECORD_INCLUDE = {
  events: { orderBy: { occurredAt: 'asc' as const } },
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
};

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  // ── Settings ──────────────────────────────────────────────────────────────

  async getSettings() {
    let settings = await this.prisma.companyAttendanceSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.companyAttendanceSettings.create({ data: {} });
    }
    return settings;
  }

  async updateSettings(dto: UpdateAttendanceSettingsDto, actorId: string) {
    const settings = await this.getSettings();
    const updated = await this.prisma.companyAttendanceSettings.update({
      where: { id: settings.id },
      data: dto,
    });
    await this.auditLogs.log({
      action: 'UPDATE',
      resource: 'company_attendance_settings',
      resourceId: settings.id,
      oldValues: settings,
      newValues: updated,
      userId: actorId,
    });
    return updated;
  }

  // ── Employee flags ─────────────────────────────────────────────────────────

  async getEmployeeFlags(userId: string) {
    return this.prisma.employeeAttendanceFlags.findUnique({ where: { userId } });
  }

  async upsertEmployeeFlags(
    userId: string,
    data: { allowManualOverride?: boolean | null; allowQrOverride?: boolean | null; enableLunchOverride?: boolean | null },
    actorId: string,
  ) {
    const old = await this.getEmployeeFlags(userId);
    const flags = await this.prisma.employeeAttendanceFlags.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    await this.auditLogs.log({
      action: old ? 'UPDATE' : 'CREATE',
      resource: 'employee_attendance_flags',
      resourceId: flags.id,
      oldValues: old,
      newValues: flags,
      userId: actorId,
    });
    return flags;
  }

  // ── Shared helpers ─────────────────────────────────────────────────────────

  private async resolveEffectiveLunch(userId: string): Promise<boolean> {
    const [settings, flags] = await Promise.all([
      this.getSettings(),
      this.getEmployeeFlags(userId),
    ]);
    return flags?.enableLunchOverride ?? settings.enableLunchTracking;
  }

  private async resolveMethodAvailability(userId: string) {
    const [settings, flags] = await Promise.all([
      this.getSettings(),
      this.getEmployeeFlags(userId),
    ]);
    return AttendanceMethodResolver.resolve(settings, flags);
  }

  private async getOrCreateTodayRecord(userId: string, timezone: string): Promise<any> {
    const settings = await this.getSettings();
    const tz = timezone || settings.timezone;
    const today = this.todayInTz(tz);

    let record = await this.prisma.attendanceRecord.findUnique({
      where: { userId_workDate: { userId, workDate: today } },
      include: RECORD_INCLUDE,
    });

    if (!record) {
      record = await this.prisma.attendanceRecord.create({
        data: { userId, workDate: today, timezone: tz },
        include: RECORD_INCLUDE,
      });
    }

    return record;
  }

  private todayInTz(timezone: string): Date {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [year, month, day] = formatter.format(now).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private getLastEvent(events: { eventType: string }[]): AttendanceEventType | null {
    if (!events.length) return null;
    return events[events.length - 1].eventType as AttendanceEventType;
  }

  private async assertCooldown(
    record: { events: { occurredAt: Date; eventType: AttendanceEventType }[] },
    action: AttendanceEventType,
  ): Promise<void> {
    const settings = await this.getSettings();
    const cooldownMs = settings.actionCooldownSeconds * 1000;
    if (cooldownMs === 0) return;

    const sameTypeEvents = record.events.filter((e) => e.eventType === action);
    if (!sameTypeEvents.length) return;

    const lastSame = sameTypeEvents[sameTypeEvents.length - 1];
    const elapsed = Date.now() - lastSame.occurredAt.getTime();
    if (elapsed < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - elapsed) / 1000);
      throw new ConflictException(
        `Action ${action} was already submitted recently. Please wait ${remaining}s before retrying.`,
      );
    }
  }

  private buildResponse(record: any) {
    const lastEvent = this.getLastEvent(record.events);
    const lunchEnabled = true; // caller passes resolved value; simple build helper
    return {
      record: {
        id: record.id,
        workDate: record.workDate,
        status: record.status,
        totalWorkMins: record.totalWorkMins,
        totalBreakMins: record.totalBreakMins,
        timezone: record.timezone,
        user: record.user,
      },
      timeline: record.events,
      currentState: lastEvent ?? 'NOT_STARTED',
    };
  }

  // ── Employee self-service (Issue #5) ───────────────────────────────────────

  async getToday(userId: string) {
    const settings = await this.getSettings();
    const today = this.todayInTz(settings.timezone);
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { userId_workDate: { userId, workDate: today } },
      include: RECORD_INCLUDE,
    });

    const availability = await this.resolveMethodAvailability(userId);
    const lunchEnabled = await this.resolveEffectiveLunch(userId);
    const lastEvent = record ? this.getLastEvent(record.events) : null;
    const nextActions = record
      ? AttendanceStateMachine.getValidNextActions(lastEvent, lunchEnabled)
      : [AttendanceEventType.CLOCK_IN];

    return {
      record: record
        ? {
            id: record.id,
            workDate: record.workDate,
            status: record.status,
            totalWorkMins: record.totalWorkMins,
            totalBreakMins: record.totalBreakMins,
            timezone: record.timezone,
            user: record.user,
          }
        : null,
      timeline: record?.events ?? [],
      currentState: lastEvent ?? 'NOT_STARTED',
      nextActions,
      methodAvailability: availability,
    };
  }

  async getHistory(userId: string, filter: AttendanceFilterDto) {
    const { page = 1, limit = 10, from, to } = filter;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (from || to) {
      where.workDate = {};
      if (from) where.workDate.gte = new Date(from);
      if (to) where.workDate.lte = new Date(to);
    }

    const [records, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { workDate: 'desc' },
        include: RECORD_INCLUDE,
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    return {
      data: records,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async performManualAction(
    userId: string,
    dto: AttendanceActionDto,
    sourceIp?: string,
    sourceDevice?: string,
  ) {
    const availability = await this.resolveMethodAvailability(userId);
    AttendanceMethodResolver.assertMethodAllowed(AttendanceMethod.MANUAL, availability);

    const lunchEnabled = await this.resolveEffectiveLunch(userId);
    this.assertLunchActionAllowed(dto.action, lunchEnabled);

    const settings = await this.getSettings();
    const record = await this.getOrCreateTodayRecord(userId, settings.timezone);
    const lastEvent = this.getLastEvent(record.events);

    AttendanceStateMachine.assertValidTransition(lastEvent, dto.action, lunchEnabled);
    await this.assertCooldown(record, dto.action);

    return this.commitEvent(record, dto.action, AttendanceMethod.MANUAL, { sourceIp, sourceDevice });
  }

  private assertLunchActionAllowed(action: AttendanceEventType, lunchEnabled: boolean): void {
    const lunchActions = [AttendanceEventType.LUNCH_OUT, AttendanceEventType.LUNCH_IN];
    if (lunchActions.includes(action) && !lunchEnabled) {
      throw new BadRequestException('Lunch tracking is not enabled.');
    }
  }

  // ── QR scan (Issue #7) ────────────────────────────────────────────────────

  async performQrScan(userId: string, dto: QrScanDto, sourceIp?: string, sourceDevice?: string) {
    const availability = await this.resolveMethodAvailability(userId);
    AttendanceMethodResolver.assertMethodAllowed(AttendanceMethod.QR, availability);

    const terminal = await this.prisma.qrTerminal.findUnique({
      where: { code: dto.terminalCode },
    });
    if (!terminal) throw new NotFoundException('QR terminal not found.');
    if (!terminal.isActive) throw new ForbiddenException('QR terminal is inactive.');
    if (terminal.expiresAt && terminal.expiresAt < new Date()) {
      throw new ForbiddenException('QR terminal has expired.');
    }
    if (
      terminal.allowedActions.length > 0 &&
      !terminal.allowedActions.includes(dto.action as any)
    ) {
      throw new ForbiddenException(`This terminal does not support the '${dto.action}' action.`);
    }

    const lunchEnabled = await this.resolveEffectiveLunch(userId);
    this.assertLunchActionAllowed(dto.action, lunchEnabled);

    const settings = await this.getSettings();
    const record = await this.getOrCreateTodayRecord(userId, settings.timezone);
    const lastEvent = this.getLastEvent(record.events);

    AttendanceStateMachine.assertValidTransition(lastEvent, dto.action, lunchEnabled);
    await this.assertCooldown(record, dto.action);

    return this.commitEvent(record, dto.action, AttendanceMethod.QR, {
      sourceIp,
      sourceDevice,
      qrTerminalId: terminal.id,
    });
  }

  private async commitEvent(
    record: any,
    action: AttendanceEventType,
    method: AttendanceMethod,
    meta: { sourceIp?: string; sourceDevice?: string; qrTerminalId?: string },
  ) {
    const event = await this.prisma.attendanceEvent.create({
      data: {
        recordId: record.id,
        eventType: action,
        method,
        occurredAt: new Date(),
        ...meta,
      },
    });

    // Recalculate totals
    const allEvents = [...record.events, event];
    const lunchEnabled = await this.resolveEffectiveLunch(record.userId);
    const totals = AttendanceCalculator.compute(allEvents);
    const isComplete = AttendanceStateMachine.isComplete(action);

    const status = isComplete
      ? AttendanceRecordStatus.COMPLETE
      : AttendanceRecordStatus.IN_PROGRESS;

    const updatedRecord = await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        totalWorkMins: totals.totalWorkMins,
        totalBreakMins: totals.totalBreakMins,
        status,
      },
      include: RECORD_INCLUDE,
    });

    const nextActions = AttendanceStateMachine.getValidNextActions(action, lunchEnabled);

    return {
      record: {
        id: updatedRecord.id,
        workDate: updatedRecord.workDate,
        status: updatedRecord.status,
        totalWorkMins: updatedRecord.totalWorkMins,
        totalBreakMins: updatedRecord.totalBreakMins,
        timezone: updatedRecord.timezone,
      },
      event,
      timeline: updatedRecord.events,
      currentState: action,
      nextActions,
    };
  }

  // ── Admin correction (Issue #12) ──────────────────────────────────────────

  async correctAttendance(
    recordId: string,
    dto: CorrectAttendanceDto,
    editorId: string,
    editorRole: string,
  ) {
    if (!['admin', 'manager'].includes(editorRole.toLowerCase())) {
      throw new ForbiddenException('Only admins or managers can correct attendance records.');
    }

    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: RECORD_INCLUDE,
    });
    if (!record) throw new NotFoundException(`Attendance record ${recordId} not found.`);
    if (record.status === AttendanceRecordStatus.COMPLETE) {
      // still allow corrections but track it
    }

    const oldData = { events: record.events, status: record.status };

    const event = await this.prisma.attendanceEvent.create({
      data: {
        recordId,
        eventType: dto.action,
        method: AttendanceMethod.MANUAL,
        occurredAt: new Date(dto.occurredAt),
        isCorrection: true,
      },
    });

    const allEvents = await this.prisma.attendanceEvent.findMany({
      where: { recordId },
      orderBy: { occurredAt: 'asc' },
    });

    const lunchEnabled = await this.resolveEffectiveLunch(record.userId);
    const totals = AttendanceCalculator.compute(allEvents as any);
    const lastEventType = allEvents[allEvents.length - 1].eventType as AttendanceEventType;
    const status = AttendanceStateMachine.isComplete(lastEventType)
      ? AttendanceRecordStatus.COMPLETE
      : AttendanceRecordStatus.IN_PROGRESS;

    const updatedRecord = await this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { totalWorkMins: totals.totalWorkMins, totalBreakMins: totals.totalBreakMins, status },
      include: RECORD_INCLUDE,
    });

    await this.prisma.attendanceCorrectionLog.create({
      data: {
        recordId,
        editorId,
        reason: dto.reason,
        oldData,
        newData: { events: updatedRecord.events, status: updatedRecord.status },
      },
    });

    await this.auditLogs.log({
      action: 'CORRECTION',
      resource: 'attendance_record',
      resourceId: recordId,
      oldValues: oldData,
      newValues: { event, totals, status },
      userId: editorId,
    });

    return updatedRecord;
  }

  // ── Admin list (Issue #14) ─────────────────────────────────────────────────

  async listAll(filter: AttendanceFilterDto) {
    const { page = 1, limit = 10, from, to, userId } = filter;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (userId) where.userId = userId;
    if (from || to) {
      where.workDate = {};
      if (from) where.workDate.gte = new Date(from);
      if (to) where.workDate.lte = new Date(to);
    }

    const [records, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ workDate: 'desc' }],
        include: {
          ...RECORD_INCLUDE,
          corrections: { orderBy: { createdAt: 'desc' } },
        },
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    return {
      data: records.map((r) => this.toTimesheetRow(r)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private toTimesheetRow(record: any) {
    const events = record.events ?? [];
    const clockIn = events.find((e: any) => e.eventType === AttendanceEventType.CLOCK_IN);
    const clockOut = events.find((e: any) => e.eventType === AttendanceEventType.CLOCK_OUT);
    const methods = [...new Set(events.map((e: any) => e.method))];

    return {
      id: record.id,
      workDate: record.workDate,
      userId: record.userId,
      user: record.user,
      clockInAt: clockIn?.occurredAt ?? null,
      clockOutAt: clockOut?.occurredAt ?? null,
      totalWorkMins: record.totalWorkMins,
      totalBreakMins: record.totalBreakMins,
      status: record.status,
      methods,
      timezone: record.timezone,
      correctionCount: record.corrections?.length ?? 0,
    };
  }

  // ── QR terminals (Issue #6) ───────────────────────────────────────────────

  async createQrTerminal(dto: CreateQrTerminalDto, actorId: string) {
    const existing = await this.prisma.qrTerminal.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Terminal code '${dto.code}' already exists.`);

    const terminal = await this.prisma.qrTerminal.create({
      data: {
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    await this.auditLogs.log({
      action: 'CREATE',
      resource: 'qr_terminal',
      resourceId: terminal.id,
      newValues: terminal,
      userId: actorId,
    });

    return terminal;
  }

  async listQrTerminals() {
    return this.prisma.qrTerminal.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async toggleQrTerminal(id: string, isActive: boolean, actorId: string) {
    const terminal = await this.prisma.qrTerminal.findUnique({ where: { id } });
    if (!terminal) throw new NotFoundException(`QR terminal ${id} not found.`);

    const updated = await this.prisma.qrTerminal.update({
      where: { id },
      data: { isActive },
    });

    await this.auditLogs.log({
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
      resource: 'qr_terminal',
      resourceId: id,
      oldValues: terminal,
      newValues: updated,
      userId: actorId,
    });

    return updated;
  }
}
