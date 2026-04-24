import { AttendanceCalculator } from './attendance-calculator';
import { AttendanceEventType } from '../enums/attendance-event-type.enum';

function event(type: AttendanceEventType, offsetMins: number) {
  const d = new Date('2026-04-24T08:00:00Z');
  d.setMinutes(d.getMinutes() + offsetMins);
  return { eventType: type, occurredAt: d };
}

describe('AttendanceCalculator', () => {
  it('computes work without lunch', () => {
    const events = [
      event(AttendanceEventType.CLOCK_IN, 0),
      event(AttendanceEventType.CLOCK_OUT, 480), // 8 hours
    ];
    const { totalWorkMins, totalBreakMins } = AttendanceCalculator.compute(events);
    expect(totalWorkMins).toBe(480);
    expect(totalBreakMins).toBe(0);
  });

  it('computes work and break with lunch', () => {
    const events = [
      event(AttendanceEventType.CLOCK_IN, 0),
      event(AttendanceEventType.LUNCH_OUT, 240),  // 4h work
      event(AttendanceEventType.LUNCH_IN, 300),   // 1h lunch
      event(AttendanceEventType.CLOCK_OUT, 480),  // 3h more work
    ];
    const { totalWorkMins, totalBreakMins } = AttendanceCalculator.compute(events);
    expect(totalWorkMins).toBe(420); // 4h + 3h
    expect(totalBreakMins).toBe(60);
  });

  it('handles multiple lunch rounds', () => {
    const events = [
      event(AttendanceEventType.CLOCK_IN, 0),
      event(AttendanceEventType.LUNCH_OUT, 120),
      event(AttendanceEventType.LUNCH_IN, 150),   // 30m break
      event(AttendanceEventType.LUNCH_OUT, 300),
      event(AttendanceEventType.LUNCH_IN, 330),   // 30m break
      event(AttendanceEventType.CLOCK_OUT, 480),
    ];
    const { totalBreakMins, totalWorkMins } = AttendanceCalculator.compute(events);
    expect(totalBreakMins).toBe(60);
    expect(totalWorkMins).toBe(420);
  });

  it('handles incomplete shift (no CLOCK_OUT)', () => {
    const events = [event(AttendanceEventType.CLOCK_IN, 0)];
    const { totalWorkMins } = AttendanceCalculator.compute(events);
    expect(totalWorkMins).toBe(0);
  });

  it('handles empty events', () => {
    const { totalWorkMins, totalBreakMins } = AttendanceCalculator.compute([]);
    expect(totalWorkMins).toBe(0);
    expect(totalBreakMins).toBe(0);
  });
});
