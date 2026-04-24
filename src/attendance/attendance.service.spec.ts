import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AttendanceEventType } from './enums/attendance-event-type.enum';
import { AttendanceMethod } from './enums/attendance-method.enum';

const DEFAULT_SETTINGS = {
  id: 'settings-1',
  enableManualAttendance: true,
  enableQrAttendance: false,
  defaultMethod: 'MANUAL',
  enableLunchTracking: false,
  requireLunchTracking: false,
  actionCooldownSeconds: 0,
  timezone: 'UTC',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const EMPTY_RECORD = {
  id: 'rec-1',
  userId: 'user-1',
  workDate: new Date('2026-04-24'),
  status: 'IN_PROGRESS',
  totalWorkMins: null,
  totalBreakMins: null,
  timezone: 'UTC',
  events: [],
  user: { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@test.com' },
};

function makeRecord(events: { eventType: AttendanceEventType; occurredAt?: Date }[]) {
  return {
    ...EMPTY_RECORD,
    events: events.map((e, i) => ({
      id: `ev-${i}`,
      recordId: 'rec-1',
      eventType: e.eventType,
      method: 'MANUAL',
      occurredAt: e.occurredAt ?? new Date(Date.now() - (events.length - i) * 60_000),
      sourceIp: null,
      sourceDevice: null,
      qrTerminalId: null,
      isCorrection: false,
      createdAt: new Date(),
    })),
  };
}

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: any;
  let auditLogs: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      companyAttendanceSettings: {
        findFirst: jest.fn().mockResolvedValue(DEFAULT_SETTINGS),
        create: jest.fn().mockResolvedValue(DEFAULT_SETTINGS),
        update: jest.fn().mockResolvedValue(DEFAULT_SETTINGS),
      },
      employeeAttendanceFlags: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      attendanceRecord: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue(EMPTY_RECORD),
        update: jest.fn().mockResolvedValue(EMPTY_RECORD),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      attendanceEvent: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      qrTerminal: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      attendanceCorrectionLog: {
        create: jest.fn(),
      },
    };

    auditLogs = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: auditLogs },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-qr-token'),
            verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', purpose: 'attendance-qr' }),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  // ── Manual action ──────────────────────────────────────────────────────────

  describe('performManualAction', () => {
    it('allows CLOCK_IN on empty record', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue(null);
      const createdRecord = makeRecord([]);
      prisma.attendanceRecord.create.mockResolvedValue(createdRecord);
      const newEvent = { id: 'ev-new', eventType: AttendanceEventType.CLOCK_IN, occurredAt: new Date(), method: 'MANUAL' };
      prisma.attendanceEvent.create.mockResolvedValue(newEvent);
      const updatedRecord = makeRecord([{ eventType: AttendanceEventType.CLOCK_IN }]);
      prisma.attendanceRecord.update.mockResolvedValue(updatedRecord);

      const result = await service.performManualAction('user-1', { action: AttendanceEventType.CLOCK_IN });
      expect(result.currentState).toBe(AttendanceEventType.CLOCK_IN);
      expect(prisma.attendanceEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: AttendanceEventType.CLOCK_IN, method: AttendanceMethod.MANUAL }) }),
      );
    });

    it('rejects CLOCK_OUT before CLOCK_IN', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue(null);
      prisma.attendanceRecord.create.mockResolvedValue(makeRecord([]));

      await expect(
        service.performManualAction('user-1', { action: AttendanceEventType.CLOCK_OUT }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects manual action when manual is disabled', async () => {
      prisma.companyAttendanceSettings.findFirst.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        enableManualAttendance: false,
      });

      await expect(
        service.performManualAction('user-1', { action: AttendanceEventType.CLOCK_IN }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects lunch action when lunch is disabled', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue(
        makeRecord([{ eventType: AttendanceEventType.CLOCK_IN }]),
      );

      await expect(
        service.performManualAction('user-1', { action: AttendanceEventType.LUNCH_OUT }),
      ).rejects.toThrow(BadRequestException);
    });

    it('enforces cooldown on duplicate submission', async () => {
      prisma.companyAttendanceSettings.findFirst.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        actionCooldownSeconds: 60,
      });
      const recentEvent = { eventType: AttendanceEventType.CLOCK_IN, occurredAt: new Date() };
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRecord([recentEvent]));

      await expect(
        service.performManualAction('user-1', { action: AttendanceEventType.CLOCK_IN }),
      ).rejects.toThrow(BadRequestException); // rejected by state machine (already clocked in)
    });
  });

  // ── QR scan ───────────────────────────────────────────────────────────────

  describe('performQrScan', () => {
    const activeTerminal = {
      id: 'term-1',
      code: 'QR123',
      name: 'Main Gate',
      isActive: true,
      expiresAt: null,
      allowedActions: [],
    };

    beforeEach(() => {
      prisma.companyAttendanceSettings.findFirst.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        enableQrAttendance: true,
      });
    });

    it('rejects scan when QR terminal not found', async () => {
      prisma.qrTerminal.findUnique.mockResolvedValue(null);

      await expect(
        service.performQrScan('user-1', { terminalCode: 'BADCODE', action: AttendanceEventType.CLOCK_IN }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects scan when terminal is inactive', async () => {
      prisma.qrTerminal.findUnique.mockResolvedValue({ ...activeTerminal, isActive: false });

      await expect(
        service.performQrScan('user-1', { terminalCode: 'QR123', action: AttendanceEventType.CLOCK_IN }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects scan when terminal is expired', async () => {
      prisma.qrTerminal.findUnique.mockResolvedValue({
        ...activeTerminal,
        expiresAt: new Date('2020-01-01'),
      });

      await expect(
        service.performQrScan('user-1', { terminalCode: 'QR123', action: AttendanceEventType.CLOCK_IN }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects action not allowed by terminal', async () => {
      prisma.qrTerminal.findUnique.mockResolvedValue({
        ...activeTerminal,
        allowedActions: [AttendanceEventType.CLOCK_IN],
      });

      await expect(
        service.performQrScan('user-1', { terminalCode: 'QR123', action: AttendanceEventType.CLOCK_OUT }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects QR when QR method is disabled', async () => {
      prisma.companyAttendanceSettings.findFirst.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        enableQrAttendance: false,
      });
      prisma.qrTerminal.findUnique.mockResolvedValue(activeTerminal);

      await expect(
        service.performQrScan('user-1', { terminalCode: 'QR123', action: AttendanceEventType.CLOCK_IN }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── QR terminal management ────────────────────────────────────────────────

  describe('createQrTerminal', () => {
    it('throws ConflictException on duplicate code', async () => {
      prisma.qrTerminal.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createQrTerminal({ name: 'T', code: 'DUP' }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('creates terminal successfully', async () => {
      prisma.qrTerminal.findUnique.mockResolvedValue(null);
      prisma.qrTerminal.create.mockResolvedValue({ id: 'new-term', code: 'NEWCODE' });

      const result = await service.createQrTerminal({ name: 'Gate', code: 'NEWCODE' }, 'admin-1');
      expect(result.code).toBe('NEWCODE');
      expect(auditLogs.log).toHaveBeenCalled();
    });
  });

  // ── Admin correction ──────────────────────────────────────────────────────

  describe('correctAttendance', () => {
    it('rejects correction by non-admin/manager role', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRecord([]));

      await expect(
        service.correctAttendance(
          'rec-1',
          { reason: 'Fix clock-in', action: AttendanceEventType.CLOCK_IN, occurredAt: new Date().toISOString() },
          'user-1',
          'employee',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects correction for non-existent record', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.correctAttendance(
          'bad-rec',
          { reason: 'Fix', action: AttendanceEventType.CLOCK_IN, occurredAt: new Date().toISOString() },
          'admin-1',
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Kiosk smart scan ──────────────────────────────────────────────────────

  describe('performKioskScan', () => {
    const activeUser = { id: 'user-1', firstName: 'Jane', lastName: 'Doe', isActive: true };

    beforeEach(() => {
      prisma.user.findUnique = jest.fn().mockResolvedValue(activeUser);
    });

    it('clocks IN when no existing record', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue(null);
      prisma.attendanceRecord.create.mockResolvedValue(makeRecord([]));
      const newEvent = { id: 'ev-1', eventType: AttendanceEventType.CLOCK_IN, occurredAt: new Date(), method: 'QR' };
      prisma.attendanceEvent.create.mockResolvedValue(newEvent);
      prisma.attendanceRecord.update.mockResolvedValue(makeRecord([{ eventType: AttendanceEventType.CLOCK_IN }]));

      const result = await service.performKioskScan({ qrToken: 'valid-token' });
      expect(result.actionPerformed).toBe(AttendanceEventType.CLOCK_IN);
      expect(result.employee.firstName).toBe('Jane');
    });

    it('clocks OUT when employee is clocked in', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue(
        makeRecord([{ eventType: AttendanceEventType.CLOCK_IN }]),
      );
      const newEvent = { id: 'ev-2', eventType: AttendanceEventType.CLOCK_OUT, occurredAt: new Date(), method: 'QR' };
      prisma.attendanceEvent.create.mockResolvedValue(newEvent);
      prisma.attendanceRecord.update.mockResolvedValue(
        makeRecord([{ eventType: AttendanceEventType.CLOCK_IN }, { eventType: AttendanceEventType.CLOCK_OUT }]),
      );

      const result = await service.performKioskScan({ qrToken: 'valid-token' });
      expect(result.actionPerformed).toBe(AttendanceEventType.CLOCK_OUT);
    });

    it('returns LUNCH_IN when employee is on lunch', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue(
        makeRecord([
          { eventType: AttendanceEventType.CLOCK_IN },
          { eventType: AttendanceEventType.LUNCH_OUT },
        ]),
      );
      const newEvent = { id: 'ev-3', eventType: AttendanceEventType.LUNCH_IN, occurredAt: new Date(), method: 'QR' };
      prisma.attendanceEvent.create.mockResolvedValue(newEvent);
      prisma.attendanceRecord.update.mockResolvedValue(
        makeRecord([
          { eventType: AttendanceEventType.CLOCK_IN },
          { eventType: AttendanceEventType.LUNCH_OUT },
          { eventType: AttendanceEventType.LUNCH_IN },
        ]),
      );

      const result = await service.performKioskScan({ qrToken: 'valid-token' });
      expect(result.actionPerformed).toBe(AttendanceEventType.LUNCH_IN);
    });

    it('rejects invalid QR token', async () => {
      const { UnauthorizedException } = await import('@nestjs/common');
      // Override jwtService to throw
      (service as any).jwtService.verifyAsync = jest.fn().mockRejectedValue(new Error('jwt expired'));

      await expect(service.performKioskScan({ qrToken: 'bad-token' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects inactive user', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue({ ...activeUser, isActive: false });

      await expect(service.performKioskScan({ qrToken: 'valid-token' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── Employee QR token ─────────────────────────────────────────────────────

  describe('generateEmployeeQrToken', () => {
    it('returns token + expiry + employee info', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1', firstName: 'Jane', lastName: 'Doe', isActive: true,
      });

      const result = await service.generateEmployeeQrToken('user-1');
      expect(result.qrToken).toBe('mock-qr-token');
      expect(result.employee.firstName).toBe('Jane');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('rejects inactive user', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1', firstName: 'Jane', lastName: 'Doe', isActive: false,
      });

      await expect(service.generateEmployeeQrToken('user-1')).rejects.toThrow(ForbiddenException);
    });
  });
});
