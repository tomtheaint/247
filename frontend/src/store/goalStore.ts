import { create } from "zustand";
import type { Goal } from "../types";
import { goalsApi } from "../api/goals";

interface GoalState {
  goals: Goal[];
  isLoading: boolean;
  fetch: () => Promise<void>;
  create: (data: Partial<Goal>) => Promise<Goal>;
  update: (id: string, data: Partial<Goal>) => Promise<void>;
  remove: (id: string, deleteEvents?: boolean) => Promise<void>;
}

export const useGoalStore = create<GoalState>((set) => ({
  goals: [],
  isLoading: false,

  fetch: async () => {
    set({ isLoading: true });
    const res = await goalsApi.list({ limit: 100 });
    set({ goals: res.data, isLoading: false });
  },

  create: async (data) => {
    const goal = await goalsApi.create(data);
    set((s) => ({ goals: [goal, ...s.goals] }));
    return goal;
  },

  update: async (id, data) => {
    const updated = await goalsApi.update(id, data);
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? updated : g)) }));
  },

  remove: async (id, deleteEvents) => {
    await goalsApi.delete(id, deleteEvents);
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
  },
}));
