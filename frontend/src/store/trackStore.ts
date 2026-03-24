import { create } from "zustand";
import type { Track } from "../types";
import { tracksApi } from "../api/tracks";

interface TrackState {
  tracks: Track[];
  myTracks: Track[];
  isLoading: boolean;
  fetch: (params?: { q?: string; category?: string; difficulty?: string }) => Promise<void>;
  fetchMine: () => Promise<void>;
  create: (data: Partial<Track>) => Promise<Track>;
  update: (id: string, data: Partial<Track>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  adopt: (id: string) => Promise<void>;
}

export const useTrackStore = create<TrackState>((set) => ({
  tracks: [],
  myTracks: [],
  isLoading: false,

  fetch: async (params) => {
    set({ isLoading: true });
    const res = await tracksApi.list(params);
    set({ tracks: res.data, isLoading: false });
  },

  fetchMine: async () => {
    const tracks = await tracksApi.mine();
    set({ myTracks: tracks });
  },

  create: async (data) => {
    const track = await tracksApi.create(data);
    set((s) => ({ myTracks: [track, ...s.myTracks] }));
    return track;
  },

  update: async (id, data) => {
    const updated = await tracksApi.update(id, data);
    set((s) => ({ myTracks: s.myTracks.map((t) => (t.id === id ? updated : t)) }));
  },

  remove: async (id) => {
    await tracksApi.delete(id);
    set((s) => ({ myTracks: s.myTracks.filter((t) => t.id !== id) }));
  },

  adopt: async (id) => {
    await tracksApi.adopt(id);
  },
}));
