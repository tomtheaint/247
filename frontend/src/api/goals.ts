import { client } from "./client";
import type { Goal, Milestone, PaginatedResponse } from "../types";

export const goalsApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    client.get<PaginatedResponse<Goal>>("/goals", { params }).then((r) => r.data),

  get: (id: string) => client.get<Goal>(`/goals/${id}`).then((r) => r.data),

  create: (data: Partial<Goal>) =>
    client.post<Goal>("/goals", data).then((r) => r.data),

  update: (id: string, data: Partial<Goal>) =>
    client.patch<Goal>(`/goals/${id}`, data).then((r) => r.data),

  delete: (id: string, deleteEvents?: boolean) =>
    client.delete(`/goals/${id}`, { params: deleteEvents ? { deleteEvents: "true" } : {} }),

  listPublic: (params?: { page?: number; limit?: number; q?: string; category?: string }) =>
    client.get<PaginatedResponse<Goal>>("/goals/community", { params }).then((r) => r.data),

  addProgress: (id: string, data: { value: number; note?: string }) =>
    client.post(`/goals/${id}/progress`, data).then((r) => r.data),

  listMilestones: (goalId: string) =>
    client.get<Milestone[]>(`/goals/${goalId}/milestones`).then((r) => r.data),

  createMilestone: (goalId: string, data: { title: string; description?: string; dueDate?: string }) =>
    client.post<Milestone>(`/goals/${goalId}/milestones`, data).then((r) => r.data),

  updateMilestone: (id: string, data: Partial<{ title: string; description: string; dueDate: string; completed: boolean }>) =>
    client.patch<Milestone>(`/goals/milestones/${id}`, data).then((r) => r.data),

  deleteMilestone: (id: string) => client.delete(`/goals/milestones/${id}`),
};
