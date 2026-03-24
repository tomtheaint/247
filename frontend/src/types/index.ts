export type GoalStatus = "ACTIVE" | "COMPLETED" | "PAUSED" | "ARCHIVED";
export type GoalCategory = "FITNESS" | "LEARNING" | "CAREER" | "HEALTH" | "CREATIVE" | "SOCIAL" | "FINANCE" | "OTHER";
export type TrackDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type UserRole = "USER" | "REVIEWER" | "ADMIN";
export type ReactionType = "LIKE" | "DISLIKE";

export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  isPublic: boolean;
  role: UserRole;
  createdAt: string;
  wakeTimeWeekday?: string;
  sleepTimeWeekday?: string;
  wakeTimeWeekend?: string;
  sleepTimeWeekend?: string;
  chronotype?: string;
  showHolidays?: boolean;
  timezone?: string;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  goalId: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  status: GoalStatus;
  color: string;
  icon: string;
  isPublic: boolean;
  programTrackId?: string | null;
  targetDate?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  totalHours?: number;
  trackGoalOrder?: number;
  milestones?: Milestone[];
  user?: { id: string; username: string; displayName?: string };
  _count?: { events: number; milestones: number };
  completedEventsCount?: number;
}

export type Priority = "HIGH" | "NORMAL" | "LOW";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  color?: string;
  isLocked: boolean;
  priority?: Priority;
  isRecurring?: boolean;
  recurringParentId?: string;
  recurrence?: Record<string, unknown> | null;
  isCompleted?: boolean;
  goalId?: string;
  goal?: { id: string; title: string; color: string; icon: string };
  trackStepId?: string;
  userId: string;
  createdAt: string;
}

export interface TrackStep {
  id: string;
  title: string;
  description: string;
  dayOffset: number;
  durationMinutes: number;
  resources?: Record<string, unknown>;
  order: number;
  trackId: string;
}

export interface Track {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  difficulty: TrackDifficulty;
  estimatedDays: number;
  isPublic: boolean;
  rating: number;
  ratingCount: number;
  adoptionCount: number;
  likes: number;
  dislikes: number;
  goals?: { id: string; title: string; icon: string; color: string; status: string; trackGoalOrder?: number; _count?: { milestones: number } }[];
  tags: string[];
  authorId: string;
  author?: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
  steps?: TrackStep[];
  _count?: { steps: number; userTracks: number };
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}
