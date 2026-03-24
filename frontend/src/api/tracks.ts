import { client } from "./client";
import type { Track, PaginatedResponse, ReactionType } from "../types";

export const tracksApi = {
  list: (params?: { page?: number; category?: string; difficulty?: string; q?: string }) =>
    client.get<PaginatedResponse<Track>>("/tracks", { params }).then((r) => r.data),

  mine: () => client.get<Track[]>("/tracks/mine").then((r) => r.data),

  get: (id: string) => client.get<Track>(`/tracks/${id}`).then((r) => r.data),

  create: (data: Partial<Track>) =>
    client.post<Track>("/tracks", data).then((r) => r.data),

  update: (id: string, data: Partial<Track>) =>
    client.patch<Track>(`/tracks/${id}`, data).then((r) => r.data),

  delete: (id: string) => client.delete(`/tracks/${id}`),

  adopt: (id: string) =>
    client.post(`/tracks/${id}/adopt`).then((r) => r.data),

  review: (id: string, data: { rating: number; body?: string }) =>
    client.post(`/tracks/${id}/review`, data).then((r) => r.data),

  react: (id: string, type: ReactionType | null) =>
    client.post<{ likes: number; dislikes: number; userReaction: ReactionType | null }>(`/tracks/${id}/react`, { type }).then((r) => r.data),

  getMyReaction: (id: string) =>
    client.get<{ userReaction: ReactionType | null }>(`/tracks/${id}/my-reaction`).then((r) => r.data),

  adminUpdate: (id: string, data: Partial<Track> & { isPublic?: boolean }) =>
    client.patch<Track>(`/tracks/${id}/admin`, data).then((r) => r.data),

  adminDelete: (id: string) => client.delete(`/tracks/${id}/admin`),

  setGoals: (id: string, goals: { id: string; order: number }[]) =>
    client.put<Track>(`/tracks/${id}/goals`, { goals }).then((r) => r.data),
};
