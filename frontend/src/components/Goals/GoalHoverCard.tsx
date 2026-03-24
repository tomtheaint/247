import type { Goal } from "../../types";

const CATEGORY_LABELS: Record<string, string> = {
  FITNESS: "Fitness", LEARNING: "Learning", CAREER: "Career", HEALTH: "Health",
  CREATIVE: "Creative", SOCIAL: "Social", FINANCE: "Finance", OTHER: "Other",
};

interface Props {
  goal: Goal;
}

export function GoalHoverCard({ goal }: Props) {
  return (
    <div
      className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 pointer-events-none
                 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700
                 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0
                 transition-all duration-150 ease-out"
    >
      {/* Arrow */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white dark:border-t-gray-800" />

      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ backgroundColor: goal.color + "22", border: `2px solid ${goal.color}44` }}
          >
            {goal.icon || "🎯"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">{goal.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{CATEGORY_LABELS[goal.category] ?? goal.category}</p>
          </div>
        </div>

        {goal.description && (
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3 mb-3">
            {goal.description}
          </p>
        )}

        <div className="flex gap-3 text-xs">
          {goal.totalHours !== undefined && goal.totalHours > 0 && (
            <div className="flex items-center gap-1 text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{goal.totalHours}h scheduled</span>
            </div>
          )}
          {(goal._count?.milestones ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span>{goal._count?.milestones} milestones</span>
            </div>
          )}
          {goal._count?.events !== undefined && (
            <div className="flex items-center gap-1 text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{goal._count.events} sessions</span>
            </div>
          )}
        </div>

        {goal.user && (
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
            by {goal.user.displayName ?? goal.user.username}
          </div>
        )}
      </div>

      <div className="px-4 pb-3">
        <p className="text-xs text-brand-500 font-medium">Click to view full details →</p>
      </div>
    </div>
  );
}
