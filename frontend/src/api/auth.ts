import { client } from "./client";
import type { AuthResponse, User } from "../types";

export const authApi = {
  register: (data: { email: string; username: string; password: string; displayName?: string }) =>
    client.post<AuthResponse>("/auth/register", data).then((r) => r.data),

  login: (data: { email: string; password: string }) =>
    client.post<AuthResponse>("/auth/login", data).then((r) => r.data),

  logout: (refreshToken: string) =>
    client.post("/auth/logout", { refreshToken }),

  me: () => client.get<User>("/auth/me").then((r) => r.data),
};
