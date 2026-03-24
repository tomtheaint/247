import { client } from "./client";
import type { CalendarEvent } from "../types";

export const eventsApi = {
  list: (params?: { start?: string; end?: string }) =>
    client.get<CalendarEvent[]>("/events", { params }).then((r) => r.data),

  listRecurring: () =>
    client.get<CalendarEvent[]>("/events/recurring").then((r) => r.data),

  get: (id: string) => client.get<CalendarEvent>(`/events/${id}`).then((r) => r.data),

  create: (data: Partial<CalendarEvent>) =>
    client.post<CalendarEvent>("/events", data).then((r) => r.data),

  update: (id: string, data: Partial<CalendarEvent> & { deltaMs?: number }) =>
    client.patch<CalendarEvent>(`/events/${id}`, data).then((r) => r.data),

  detachInstance: (parentId: string, originalStart: string, newStart: string, newEnd: string) =>
    client.post<CalendarEvent>(`/events/${parentId}/detach-instance`, { originalStart, newStart, newEnd }).then((r) => r.data),

  delete: (id: string) => client.delete(`/events/${id}`),

  deleteAll: () => client.delete<{ deleted: number }>("/events").then((r) => r.data),
};
