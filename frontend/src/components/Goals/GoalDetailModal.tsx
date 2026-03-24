import { useEffect, useState } from "react";
import { goalsApi } from "../../api/goals";
import type { Goal, Milestone } from "../../types";

const CATEGORY_LABELS: Record<string, string> = {
  FITNESS: "Fitness", LEARNING: "Learning", CAREER: "Career", HEALTH: "Health",
  CREATIVE: "Creative", SOCIAL: "Social", FINANCE: "Finance", OTHER: "Other",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400",
  COMPLETED: "text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400",
  PAUSED: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400",
  ARCHIVED: "text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400",
};

interface Props {
  goal: Goal;
  onClose: () => void;
}

function MilestoneRow({ m, index }: { m: Milestone; index: number }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
        m.completed
          ? "bg-green-500 text-white"
          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
      }`}>
        {m.completed ? "✓" : index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${m.completed ? "line-through text-gray-400" : "text-gray-900 dark:text-white"}`}>
          {m.title}
        </p>
        {m.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.description}</p>
        )}
        {m.dueDate && (
          <p className="text-xs text-gray-400 mt-0.5">
            Due {new Date(m.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        )}
      </div>
    </div>
  );
}

export function GoalDetailModal({ goal: initialGoal, onClose }: Props) {
  const [goal, setGoal] = useState<Goal>(initialGoal);
  const [milestones, setMilestones] = useState<Milestone[]>(initialGoal.milestones ?? []);
  const [loadingMilestones, setLoadingMilestones] = useState(!initialGoal.milestones);

  // Load milestones if not already present
  useEffect(() => {
    if (!initialGoal.milestones) {
      goalsApi.listMilestones(initialGoal.id)
        .then(setMilestones)
        .catch(() => {})
        .finally(() => setLoadingMilestones(false));
    }
  }, [initialGoal.id, initialGoal.milestones]);

  const completedMilestones = milestones.filter((m) => m.completed).length;
  const progressPct = milestones.length > 0 ? Math.round((completedMilestones / milestones.length) * 100) : 0;
  const totalHours = goal.totalHours ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 pb-4" style={{ background: `linear-gradient(135deg, ${goal.color}18, ${goal.color}08)` }}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-black/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-start gap-4 pr-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
              style={{ backgroundColor: goal.color + "25", border: `2px solid ${goal.color}50` }}
            >
              {goal.icon || "🎯"}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{goal.title}</h2>
              {goal.user && (
                <p className="text-sm text-gray-500 mt-0.5">by {goal.user.displayName ?? goal.user.username}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {CATEGORY_LABELS[goal.category] ?? goal.category}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[goal.status]}`}>
                  {goal.status.charAt(0) + goal.status.slice(1).toLowerCase()}
                </span>
                {goal.targetDate && (
                  <span className="text-xs text-gray-400">
                    Target: {new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-px bg-gray-100 dark:bg-gray-700 border-y border-gray-100 dark:border-gray-700">
          {[
            { label: "Scheduled", value: `${totalHours}h`, sub: "total hours" },
            { label: "Events", value: String(goal._count?.events ?? 0), sub: "sessions" },
            { label: "Milestones", value: String(milestones.length), sub: `${completedMilestones} done` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white dark:bg-gray-800 px-4 py-3 text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-xs text-gray-500">{sub}</p>
            </div>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Description */}
          {goal.description && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">About</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{goal.description}</p>
            </div>
          )}

          {/* Milestone progress */}
          {milestones.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Milestones — {completedMilestones}/{milestones.length}
                </h3>
                <span className="text-xs font-medium text-gray-500">{progressPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-4 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progressPct}%`, backgroundColor: goal.color }}
                />
              </div>
              <div className="space-y-3">
                {loadingMilestones
                  ? [...Array(3)].map((_, i) => <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)
                  : milestones.map((m, i) => <MilestoneRow key={m.id} m={m} index={i} />)
                }
              </div>
            </div>
          )}

          {milestones.length === 0 && !loadingMilestones && (
            <div className="text-center py-6 text-gray-400 text-sm">No milestones added yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
