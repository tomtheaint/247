import { create } from "zustand";
import type { CalendarEvent } from "../types";
import { eventsApi } from "../api/events";

interface EventState {
  events: CalendarEvent[];
  isLoading: boolean;
  fetch: (start?: string, end?: string) => Promise<void>;
  create: (data: Partial<CalendarEvent>) => Promise<CalendarEvent>;
  update: (id: string, data: Partial<CalendarEvent> & { deltaMs?: number }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useEventStore = create<EventState>((set) => ({
  events: [],
  isLoading: false,

  fetch: async (start, end) => {
    set({ isLoading: true });
    const events = await eventsApi.list({ start, end });
    set({ events, isLoading: false });
  },

  create: async (data) => {
    const event = await eventsApi.create(data);
    set((s) => ({ events: [...s.events, event] }));
    return event;
  },

  update: async (id, data) => {
    const updated = await eventsApi.update(id, data);
    set((s) => ({ events: s.events.map((e) => (e.id === id ? updated : e)) }));
  },

  remove: async (id) => {
    await eventsApi.delete(id);
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
  },
}));
