import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { reviewerApi } from "../api/admin";
import { GoalHoverCard } from "../components/Goals/GoalHoverCard";
import { GoalDetailModal } from "../components/Goals/GoalDetailModal";
import type { Goal } from "../types";

interface ReviewerGoal {
  id: string;
  title: string;
  description?: string;
  icon: string;
  color: string;
  status: string;
  isPublic: boolean;
  totalHours: number;
  deletedAt: string | null;
  user: { id: string; username: string; displayName?: string };
  milestones: { id: string; title: string; description?: string; dueDate?: string; completed: boolean; completedAt?: string; goalId: string; createdAt: string }[];
  _count: { events: number; milestones: number };
}

// Cast to Goal shape for reuse with GoalHoverCard / GoalDetailModal
function toGoal(g: ReviewerGoal): Goal {
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    category: "OTHER" as never,
    status: g.status as never,
    color: g.color,
    icon: g.icon,
    isPublic: g.isPublic,
    totalHours: g.totalHours,
    userId: g.user.id,
    user: g.user,
    milestones: g.milestones,
    _count: g._count,
    createdAt: "",
    updatedAt: "",
  };
}

function DeletedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded font-medium">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      deleted by user
    </span>
  );
}

// ─── Promote modal ─────────────────────────────────────────────────────────────

interface PromoteModalProps {
  goal: ReviewerGoal;
  onClose: () => void;
  onDone: () => void;
}

function PromoteModal({ goal, onClose, onDone }: PromoteModalProps) {
  const [form, setForm] = useState({
    title: goal.title,
    description: goal.description ?? "",
    difficulty: "BEGINNER",
    estimatedDays: String(Math.max(30, goal.milestones.length * 7)),
    tags: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await reviewerApi.promote(goal.id, {
        title: form.title,
        description: form.description || undefined,
        difficulty: form.difficulty as never,
        estimatedDays: Number(form.estimatedDays),
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      });
      toast.success("Goal promoted to public track!");
      onDone();
    } catch {
      toast.error("Failed to promote goal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Promote to Track</h2>
        <p className="text-sm text-gray-500 mb-4">
          Creates a public track from <span className="font-medium">{goal.user.displayName ?? goal.user.username}</span>'s goal.
          {goal.milestones.length > 0 && ` ${goal.milestones.length} milestones will become track steps.`}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Track Title</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Difficulty</label>
              <select value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Estimated Days</label>
              <input type="number" min={1} value={form.estimatedDays} onChange={(e) => setForm((f) => ({ ...f, estimatedDays: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tags (comma-separated)</label>
            <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="e.g. fitness, running, beginner"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          {goal.milestones.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Steps from milestones:</p>
              {goal.milestones.map((m, i) => (
                <div key={m.id} className="flex items-start gap-2 text-sm">
                  <span className="text-gray-400 shrink-0">{i + 1}.</span>
                  <div>
                    <span className="text-gray-800 dark:text-gray-200">{m.title}</span>
                    {m.dueDate && <span className="text-xs text-gray-400 ml-2">{new Date(m.dueDate).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={submitting}
              className="flex-1 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {submitting ? "Promoting…" : "Promote to Track"}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reviewer page ─────────────────────────────────────────────────────────────

export function ReviewerPage() {
  const [goals, setGoals] = useState<ReviewerGoal[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState<ReviewerGoal | null>(null);
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ReviewerGoal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reviewerApi.listAllGoals({ page, limit: 20, q: search || undefined, includeDeleted: showDeleted });
      setGoals(res.data);
      setTotal(res.total);
    } catch {
      toast.error("Failed to load goals");
    } finally {
      setLoading(false);
    }
  }, [page, search, showDeleted]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await reviewerApi.deleteGoal(confirmDelete.id);
      toast.success("Goal permanently deleted");
      setConfirmDelete(null);
      load();
    } catch {
      toast.error("Failed to delete goal");
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reviewer — All Goals</h1>
        <p className="text-gray-500 text-sm mt-1">{total} goals across all users</p>
      </div>

      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <input type="text" placeholder="Search goals…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-sm px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => { setShowDeleted(e.target.checked); setPage(1); }}
            className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">Show user-deleted goals</span>
        </label>
      </div>

      <div className="space-y-3">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 animate-pulse" />
          ))
        ) : goals.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No goals found</div>
        ) : (
          goals.map((goal) => {
            const isDeleted = !!goal.deletedAt;
            return (
              <div
                key={goal.id}
                className={`relative group bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-all ${
                  isDeleted
                    ? "border-red-200 dark:border-red-900/50 opacity-75"
                    : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-md"
                }`}
              >
                {/* Hover tooltip */}
                <GoalHoverCard goal={toGoal(goal)} />

                <div className="flex items-center gap-3 p-4">
                  {/* Icon — click opens detail */}
                  <button
                    onClick={() => !isDeleted && setDetailGoal(toGoal(goal))}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform hover:scale-110"
                    style={{ backgroundColor: goal.color + "22", border: `2px solid ${isDeleted ? "#ef444466" : goal.color + "44"}` }}
                  >
                    {goal.icon || "🎯"}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => !isDeleted && setDetailGoal(toGoal(goal))}
                        className={`font-semibold truncate ${isDeleted ? "line-through text-gray-400 cursor-default" : "text-gray-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors"}`}
                      >
                        {goal.title}
                      </button>
                      <span className="text-xs text-gray-400 shrink-0">by @{goal.user.username}</span>
                      {isDeleted && <DeletedBadge />}
                      {!isDeleted && goal.isPublic && (
                        <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded font-medium">public</span>
                      )}
                    </div>
                    <div className="flex gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                      {goal.totalHours > 0 && <span>{goal.totalHours}h scheduled</span>}
                      <span>{goal._count.events} events</span>
                      <span>{goal._count.milestones} milestones</span>
                      {!isDeleted && (
                        <span className={`capitalize ${goal.status === "ACTIVE" ? "text-green-500" : ""}`}>{goal.status.toLowerCase()}</span>
                      )}
                      {isDeleted && (
                        <span className="text-red-400">Deleted {new Date(goal.deletedAt!).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isDeleted && (
                      <>
                        <button
                          onClick={() => setDetailGoal(toGoal(goal))}
                          className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-brand-600 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                        >
                          View details
                        </button>
                        <button
                          onClick={() => setPromoting(goal)}
                          className="px-2.5 py-1.5 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
                        >
                          Promote
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setConfirmDelete(goal)}
                      title="Permanently delete this goal"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Next
          </button>
        </div>
      )}

      {promoting && (
        <PromoteModal goal={promoting} onClose={() => setPromoting(null)} onDone={() => { setPromoting(null); load(); }} />
      )}

      {detailGoal && (
        <GoalDetailModal goal={detailGoal} onClose={() => setDetailGoal(null)} />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Permanently delete goal?</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              <span className="font-medium text-gray-800 dark:text-gray-200">"{confirmDelete.title}"</span>
              {" "}by <span className="font-medium text-gray-800 dark:text-gray-200">@{confirmDelete.user.username}</span>
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mb-6">
              This will permanently remove the goal and all associated data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting…" : "Yes, delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
