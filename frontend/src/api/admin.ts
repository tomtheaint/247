import { client } from "./client";
import type { User, UserRole, PaginatedResponse } from "../types";

export const adminApi = {
  listUsers: (params?: { page?: number; limit?: number; q?: string }) =>
    client.get<PaginatedResponse<User>>("/admin/users", { params }).then((r) => r.data),

  updateRole: (id: string, role: UserRole) =>
    client.patch<User>(`/admin/users/${id}/role`, { role }).then((r) => r.data),

  seedTestData: () =>
    client.post<{ goals: string[]; trackId: string; eventsCreated: number }>("/admin/seed-test-data").then((r) => r.data),
};

export const reviewerApi = {
  listAllGoals: (params?: { page?: number; limit?: number; q?: string; includeDeleted?: boolean }) =>
    client.get<PaginatedResponse<{ id: string; title: string; description?: string; icon: string; color: string; status: string; isPublic: boolean; totalHours: number; deletedAt: string | null; user: { id: string; username: string; displayName?: string }; milestones: { id: string; title: string; description?: string; dueDate?: string; completed: boolean; completedAt?: string; goalId: string; createdAt: string }[]; _count: { events: number; milestones: number } }>>("/reviewer/goals", { params }).then((r) => r.data),

  promote: (goalId: string, data: { title?: string; description?: string; difficulty?: string; estimatedDays?: number; tags?: string[] }) =>
    client.post(`/reviewer/goals/${goalId}/promote`, data).then((r) => r.data),

  deleteGoal: (goalId: string) =>
    client.delete(`/reviewer/goals/${goalId}`).then((r) => r.data),
};
