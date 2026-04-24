import { AttendanceEventType } from '../enums/attendance-event-type.enum';

interface EventSlim {
  eventType: AttendanceEventType;
  occurredAt: Date;
}

export interface AttendanceTotals {
  totalWorkMins: number;
  totalBreakMins: number;
}

export class AttendanceCalculator {
  static compute(events: EventSlim[]): AttendanceTotals {
    const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    let totalWorkMs = 0;
    let totalBreakMs = 0;
    let clockInAt: Date | null = null;
    let lunchOutAt: Date | null = null;

    for (const ev of sorted) {
      switch (ev.eventType) {
        case AttendanceEventType.CLOCK_IN:
          clockInAt = ev.occurredAt;
          break;

        case AttendanceEventType.LUNCH_OUT:
          if (clockInAt) {
            totalWorkMs += ev.occurredAt.getTime() - clockInAt.getTime();
            clockInAt = null;
          }
          lunchOutAt = ev.occurredAt;
          break;

        case AttendanceEventType.LUNCH_IN:
          if (lunchOutAt) {
            totalBreakMs += ev.occurredAt.getTime() - lunchOutAt.getTime();
            lunchOutAt = null;
          }
          clockInAt = ev.occurredAt;
          break;

        case AttendanceEventType.CLOCK_OUT:
          if (clockInAt) {
            totalWorkMs += ev.occurredAt.getTime() - clockInAt.getTime();
            clockInAt = null;
          }
          break;
      }
    }

    return {
      totalWorkMins: Math.floor(totalWorkMs / 60_000),
      totalBreakMins: Math.floor(totalBreakMs / 60_000),
    };
  }
}
