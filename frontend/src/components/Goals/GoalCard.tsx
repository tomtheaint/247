import { useState } from "react";
import type { Goal } from "../../types";
import { CategoryBadge, StatusBadge } from "../UI/Badge";
import { MilestonePanel } from "./MilestonePanel";
import { format } from "date-fns";

interface Props {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
  onSchedule: (goal: Goal) => void;
  onComplete: (id: string, status: "COMPLETED" | "ACTIVE") => void;
}

export function GoalCard({ goal, onEdit, onDelete, onSchedule, onComplete }: Props) {
  const [showMilestones, setShowMilestones] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ backgroundColor: goal.color + "22", border: `2px solid ${goal.color}44` }}
          >
            {goal.icon || "🎯"}
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{goal.title}</h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onComplete(goal.id, goal.status === "COMPLETED" ? "ACTIVE" : "COMPLETED")}
            title={goal.status === "COMPLETED" ? "Reopen goal" : "Mark complete"}
            className={`p-1.5 rounded-lg transition-colors ${
              goal.status === "COMPLETED"
                ? "text-green-500 hover:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                : "text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
            }`}
          >
            <svg className="w-4 h-4" fill={goal.status === "COMPLETED" ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={() => onEdit(goal)}
            className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {goal.description && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{goal.description}</p>
      )}

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <CategoryBadge category={goal.category} />
        <StatusBadge status={goal.status} />
        {goal.targetDate && (
          <span className="text-xs text-gray-400">
            Due {format(new Date(goal.targetDate), "MMM d, yyyy")}
          </span>
        )}
      </div>

      {goal._count && goal._count.events > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>
              {goal.completedEventsCount ?? 0} / {goal._count.events} sessions completed
            </span>
            <span>{Math.round(((goal.completedEventsCount ?? 0) / goal._count.events) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: `${Math.round(((goal.completedEventsCount ?? 0) / goal._count.events) * 100)}%`,
                backgroundColor: goal.color,
              }}
            />
          </div>
        </div>
      )}
      {goal._count && (
        <div className="flex gap-4 mt-2 text-xs text-gray-400">
          {goal._count.events === 0 && <span>0 events</span>}
          <button
            onClick={() => setShowMilestones((v) => !v)}
            className="hover:text-brand-500 transition-colors flex items-center gap-1"
          >
            {goal._count.milestones} milestones
            <svg className={`w-3 h-3 transition-transform ${showMilestones ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {showMilestones && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <MilestonePanel goalId={goal.id} />
        </div>
      )}

      <button
        onClick={() => onSchedule(goal)}
        className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Schedule sessions
      </button>
    </div>
  );
}
