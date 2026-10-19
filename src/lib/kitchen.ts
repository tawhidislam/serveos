import { z } from 'zod';

export const kitchenMenuSchema = z.array(z.object({
  id: z.string(), name: z.string(), is_available: z.boolean(), category: z.string(), branch_id: z.string().nullable(),
}));
export const kitchenHistorySchema = z.object({
  total: z.number(), orders: z.array(z.object({
    id: z.string(), ticket_number: z.number().nullable(), status: z.string(), created_at: z.string(), notes: z.string().nullable(), table_label: z.string(),
    kitchen_started_at: z.string().nullable(), kitchen_due_at: z.string().nullable(), kitchen_ready_at: z.string().nullable(), kitchen_target_minutes: z.number().nullable(),
    items: z.array(z.object({ id: z.string(), name: z.string(), quantity: z.number(), notes: z.string().nullable(), selected_tags: z.array(z.string()).nullish().transform(value => value ?? []), prep_time_minutes: z.number().nullable() })),
  })),
});
export const kitchenReportSchema = z.object({
  summary: z.object({ prepared: z.number(), average_minutes: z.number().nullable(), late: z.number(), on_time_percent: z.number().nullable(), average_delay_minutes: z.number().nullable() }),
  daily: z.array(z.object({ day: z.string(), prepared: z.number(), average_minutes: z.number(), late: z.number() })),
});

export function kitchenCountdown(dueAt: string, now: number) {
  const remaining = new Date(dueAt).getTime() - now;
  const seconds = Math.floor(Math.abs(remaining) / 1000);
  return { overdue: remaining <= 0, label: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, remaining };
}

export function preparationMinutes(start: string | null, ready: string | null): number | null {
  if (!start || !ready) return null;
  const duration = (new Date(ready).getTime() - new Date(start).getTime()) / 60_000;
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}
