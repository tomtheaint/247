import { clsx } from "clsx";
import type { GoalCategory, TrackDifficulty } from "../../types";

const categoryColors: Record<GoalCategory, string> = {
  FITNESS: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  LEARNING: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  CAREER: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  HEALTH: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  CREATIVE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  SOCIAL: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  FINANCE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  OTHER: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

const difficultyColors: Record<TrackDifficulty, string> = {
  BEGINNER: "bg-green-100 text-green-800",
  INTERMEDIATE: "bg-yellow-100 text-yellow-800",
  ADVANCED: "bg-red-100 text-red-800",
};

export function CategoryBadge({ category }: { category: GoalCategory }) {
  return (
    <span className={clsx("inline-flex px-2 py-0.5 rounded text-xs font-medium", categoryColors[category])}>
      {category.charAt(0) + category.slice(1).toLowerCase()}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: TrackDifficulty }) {
  return (
    <span className={clsx("inline-flex px-2 py-0.5 rounded text-xs font-medium", difficultyColors[difficulty])}>
      {difficulty.charAt(0) + difficulty.slice(1).toLowerCase()}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: "bg-brand-100 text-brand-800",
    COMPLETED: "bg-green-100 text-green-800",
    PAUSED: "bg-yellow-100 text-yellow-800",
    ARCHIVED: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={clsx("inline-flex px-2 py-0.5 rounded text-xs font-medium", colors[status] ?? "bg-gray-100 text-gray-600")}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
