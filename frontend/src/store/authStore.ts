import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";
import { authApi } from "../api/auth";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; username: string; password: string; displayName?: string; timezone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        const data = await authApi.login({ email, password });
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false });
      },

      register: async (payload) => {
        set({ isLoading: true });
        const data = await authApi.register(payload);
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false });
      },

      logout: async () => {
        const rt = get().refreshToken;
        if (rt) await authApi.logout(rt).catch(() => {});
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        set({ user: null, accessToken: null, refreshToken: null });
      },

      loadUser: async () => {
        if (!localStorage.getItem("accessToken")) return;
        try {
          const user = await authApi.me();
          set({ user });
        } catch {
          set({ user: null });
        }
      },
    }),
    { name: "auth-store", partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken }) }
  )
);
