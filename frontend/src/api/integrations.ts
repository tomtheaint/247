import { client } from "./client";

export interface Integration {
  provider: string;
  email?: string;
  createdAt: string;
}

export const integrationsApi = {
  list: () => client.get<Integration[]>("/integrations").then((r) => r.data),

  getGoogleAuthUrl: () =>
    client.get<{ url: string }>("/integrations/google/auth-url").then((r) => r.data.url),

  syncGoogle: () => client.post<{ synced: number }>("/integrations/google/sync").then((r) => r.data),

  getMicrosoftAuthUrl: () =>
    client.get<{ url: string }>("/integrations/microsoft/auth-url").then((r) => r.data.url),

  syncMicrosoft: () => client.post<{ synced: number }>("/integrations/microsoft/sync").then((r) => r.data),

  disconnect: (provider: string) => client.delete(`/integrations/${provider}`),
};
