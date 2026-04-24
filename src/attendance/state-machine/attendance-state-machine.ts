import { BadRequestException } from '@nestjs/common';
import { AttendanceEventType } from '../enums/attendance-event-type.enum';

// Maps each event type to the set of valid next events
const VALID_TRANSITIONS: Record<AttendanceEventType | 'NONE', AttendanceEventType[]> = {
  NONE: [AttendanceEventType.CLOCK_IN],
  [AttendanceEventType.CLOCK_IN]: [AttendanceEventType.LUNCH_OUT, AttendanceEventType.CLOCK_OUT],
  [AttendanceEventType.LUNCH_OUT]: [AttendanceEventType.LUNCH_IN],
  [AttendanceEventType.LUNCH_IN]: [AttendanceEventType.LUNCH_OUT, AttendanceEventType.CLOCK_OUT],
  [AttendanceEventType.CLOCK_OUT]: [],
};

// When lunch tracking is disabled, skip lunch steps entirely
const VALID_TRANSITIONS_NO_LUNCH: Record<AttendanceEventType | 'NONE', AttendanceEventType[]> = {
  NONE: [AttendanceEventType.CLOCK_IN],
  [AttendanceEventType.CLOCK_IN]: [AttendanceEventType.CLOCK_OUT],
  [AttendanceEventType.LUNCH_OUT]: [],
  [AttendanceEventType.LUNCH_IN]: [AttendanceEventType.CLOCK_OUT],
  [AttendanceEventType.CLOCK_OUT]: [],
};

export class AttendanceStateMachine {
  static getValidNextActions(
    lastEvent: AttendanceEventType | null,
    lunchEnabled: boolean,
  ): AttendanceEventType[] {
    const map = lunchEnabled ? VALID_TRANSITIONS : VALID_TRANSITIONS_NO_LUNCH;
    const key = lastEvent ?? 'NONE';
    return map[key] ?? [];
  }

  static assertValidTransition(
    lastEvent: AttendanceEventType | null,
    next: AttendanceEventType,
    lunchEnabled: boolean,
  ): void {
    const valid = this.getValidNextActions(lastEvent, lunchEnabled);
    if (!valid.includes(next)) {
      const currentState = lastEvent ?? 'not started';
      throw new BadRequestException(
        `Cannot perform ${next} when current state is '${currentState}'. ` +
          `Valid next actions: ${valid.length ? valid.join(', ') : 'none (shift is complete)'}`,
      );
    }
  }

  static isComplete(lastEvent: AttendanceEventType | null): boolean {
    return lastEvent === AttendanceEventType.CLOCK_OUT;
  }
}
