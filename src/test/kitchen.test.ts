import { describe, expect, it } from 'vitest';
import { kitchenCountdown, preparationMinutes, kitchenReportSchema } from '@/lib/kitchen';

describe('kitchen timing', () => {
  it('counts down from a fixed server deadline across unrelated order edits', () => {
    const due = '2026-10-17T12:15:00Z';
    expect(kitchenCountdown(due, Date.parse('2026-10-17T12:10:00Z'))).toMatchObject({ label: '5:00', overdue: false });
    expect(kitchenCountdown(due, Date.parse('2026-10-17T12:17:03Z'))).toMatchObject({ label: '2:03', overdue: true });
    expect(kitchenCountdown(due, Date.parse(due)).overdue).toBe(true);
  });
  it('does not invent durations for older tickets or invalid timestamp pairs', () => {
    expect(preparationMinutes(null, '2026-10-17T12:10:00Z')).toBeNull();
    expect(preparationMinutes('2026-10-17T12:15:00Z', '2026-10-17T12:10:00Z')).toBeNull();
    expect(preparationMinutes('2026-10-17T12:00:00Z', '2026-10-17T12:10:30Z')).toBe(10.5);
  });
  it('preserves missing metrics as unknown when no preparations were tracked', () => {
    expect(kitchenReportSchema.parse({ summary: { prepared: 0, average_minutes: null, late: 0, on_time_percent: null, average_delay_minutes: null }, daily: [] }).summary.average_minutes).toBeNull();
  });
});
