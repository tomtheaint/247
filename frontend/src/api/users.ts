import { client } from "./client";
import type { User } from "../types";

export interface UserPreferences {
  displayName?: string;
  bio?: string;
  isPublic?: boolean;
  wakeTimeWeekday?: string;
  sleepTimeWeekday?: string;
  wakeTimeWeekend?: string;
  sleepTimeWeekend?: string;
  chronotype?: "EARLY_BIRD" | "MID_DAY" | "NIGHT_OWL";
  showHolidays?: boolean;
  timezone?: string;
}

export const usersApi = {
  getMe: () => client.get<User & UserPreferences>("/users/me").then((r) => r.data),
  updateMe: (data: UserPreferences) =>
    client.patch<User & UserPreferences>("/users/me", data).then((r) => r.data),
};
