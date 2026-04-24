import { BadRequestException } from '@nestjs/common';
import { AttendanceStateMachine } from './attendance-state-machine';
import { AttendanceEventType } from '../enums/attendance-event-type.enum';

describe('AttendanceStateMachine', () => {
  describe('getValidNextActions', () => {
    it('returns CLOCK_IN when no event yet', () => {
      const next = AttendanceStateMachine.getValidNextActions(null, true);
      expect(next).toEqual([AttendanceEventType.CLOCK_IN]);
    });

    it('after CLOCK_IN with lunch enabled: LUNCH_OUT + CLOCK_OUT', () => {
      const next = AttendanceStateMachine.getValidNextActions(AttendanceEventType.CLOCK_IN, true);
      expect(next).toContain(AttendanceEventType.LUNCH_OUT);
      expect(next).toContain(AttendanceEventType.CLOCK_OUT);
    });

    it('after CLOCK_IN with lunch disabled: CLOCK_OUT only', () => {
      const next = AttendanceStateMachine.getValidNextActions(AttendanceEventType.CLOCK_IN, false);
      expect(next).toEqual([AttendanceEventType.CLOCK_OUT]);
    });

    it('after LUNCH_OUT: LUNCH_IN only', () => {
      const next = AttendanceStateMachine.getValidNextActions(AttendanceEventType.LUNCH_OUT, true);
      expect(next).toEqual([AttendanceEventType.LUNCH_IN]);
    });

    it('after CLOCK_OUT: empty (shift complete)', () => {
      const next = AttendanceStateMachine.getValidNextActions(AttendanceEventType.CLOCK_OUT, true);
      expect(next).toEqual([]);
    });
  });

  describe('assertValidTransition', () => {
    it('allows valid transition', () => {
      expect(() =>
        AttendanceStateMachine.assertValidTransition(null, AttendanceEventType.CLOCK_IN, true),
      ).not.toThrow();
    });

    it('rejects CLOCK_OUT before CLOCK_IN', () => {
      expect(() =>
        AttendanceStateMachine.assertValidTransition(null, AttendanceEventType.CLOCK_OUT, true),
      ).toThrow(BadRequestException);
    });

    it('rejects LUNCH_OUT when lunch disabled', () => {
      expect(() =>
        AttendanceStateMachine.assertValidTransition(
          AttendanceEventType.CLOCK_IN,
          AttendanceEventType.LUNCH_OUT,
          false,
        ),
      ).toThrow(BadRequestException);
    });

    it('rejects double CLOCK_IN', () => {
      expect(() =>
        AttendanceStateMachine.assertValidTransition(
          AttendanceEventType.CLOCK_IN,
          AttendanceEventType.CLOCK_IN,
          true,
        ),
      ).toThrow(BadRequestException);
    });

    it('rejects any action after CLOCK_OUT', () => {
      expect(() =>
        AttendanceStateMachine.assertValidTransition(
          AttendanceEventType.CLOCK_OUT,
          AttendanceEventType.CLOCK_IN,
          true,
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('isComplete', () => {
    it('returns true only for CLOCK_OUT', () => {
      expect(AttendanceStateMachine.isComplete(AttendanceEventType.CLOCK_OUT)).toBe(true);
      expect(AttendanceStateMachine.isComplete(AttendanceEventType.CLOCK_IN)).toBe(false);
      expect(AttendanceStateMachine.isComplete(null)).toBe(false);
    });
  });
});
