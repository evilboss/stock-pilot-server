import { ForbiddenException } from '@nestjs/common';
import { AttendanceMethod } from '../enums/attendance-method.enum';

interface SettingsSlim {
  enableManualAttendance: boolean;
  enableQrAttendance: boolean;
}

interface FlagsSlim {
  allowManualOverride: boolean | null;
  allowQrOverride: boolean | null;
}

export interface MethodAvailability {
  manualEnabled: boolean;
  qrEnabled: boolean;
  disabledReason?: string;
}

export class AttendanceMethodResolver {
  static resolve(settings: SettingsSlim, flags: FlagsSlim | null): MethodAvailability {
    const manualEnabled =
      flags?.allowManualOverride ?? settings.enableManualAttendance;
    const qrEnabled =
      flags?.allowQrOverride ?? settings.enableQrAttendance;

    const disabledReason =
      !manualEnabled && !qrEnabled
        ? 'Attendance is not enabled for your account.'
        : undefined;

    return { manualEnabled, qrEnabled, disabledReason };
  }

  static assertMethodAllowed(method: AttendanceMethod, availability: MethodAvailability): void {
    if (method === AttendanceMethod.MANUAL && !availability.manualEnabled) {
      throw new ForbiddenException('Manual attendance is not enabled for your account.');
    }
    if (method === AttendanceMethod.QR && !availability.qrEnabled) {
      throw new ForbiddenException('QR attendance is not enabled for your account.');
    }
  }
}
