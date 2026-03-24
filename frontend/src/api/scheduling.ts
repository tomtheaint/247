import { client } from "./client";
import type { CalendarEvent } from "../types";

const tz = () => new Date().getTimezoneOffset();

export const schedulingApi = {
  getConflicts: (start: string, end: string) =>
    client
      .get<{
        conflictedIds: string[];
        conflictedRecurringParentIds: string[];
        conflictedRecurringInstances: Array<{ parentId: string; startTime: string }>;
        conflictingByParent: Record<string, Array<{ title: string; startTime: string; endTime: string }>>;
        conflictingByEvent: Record<string, Array<{ title: string; startTime: string; endTime: string }>>;
      }>("/scheduling/conflicts", { params: { start, end, tzOffset: tz() } })
      .then((r) => r.data),

  resolveConflicts: (start: string, end: string) =>
    client
      .post<{ resolved: number; unresolvable: string[]; unresolvableRecurring: string[] }>("/scheduling/resolve-conflicts", { start, end, tzOffset: tz() })
      .then((r) => r.data),

  optimize: (start: string, end: string) =>
    client
      .post<{ optimized: number; unplaceable: string[]; unresolvableRecurring: string[] }>("/scheduling/optimize", { start, end, tzOffset: tz() })
      .then((r) => r.data),

  snooze: (eventId: string) =>
    client
      .post<CalendarEvent>(`/scheduling/snooze/${eventId}`, { tzOffset: tz() })
      .then((r) => r.data),

  previewSnooze: (eventId: string) =>
    client
      .post<{ current: { startTime: string; endTime: string }; proposed: { startTime: string; endTime: string } | null }>(
        `/scheduling/snooze/${eventId}`,
        { tzOffset: tz(), dryRun: true }
      )
      .then((r) => r.data),

  takeDayOff: (date: string) =>
    client
      .post<{ rescheduled: number; unschedulable: string[]; total: number }>("/scheduling/take-day-off", { date, tzOffset: tz() })
      .then((r) => r.data),
};
