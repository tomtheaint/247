import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { goalsApi } from "../../api/goals";
import type { Milestone } from "../../types";

interface Props {
  goalId: string;
}

export function MilestonePanel({ goalId }: Props) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    goalsApi.listMilestones(goalId)
      .then(setMilestones)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [goalId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const m = await goalsApi.createMilestone(goalId, {
        title: form.title,
        description: form.description || undefined,
        dueDate: form.dueDate || undefined,
      });
      setMilestones((prev) => [...prev, m].sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }));
      setForm({ title: "", description: "", dueDate: "" });
      setAdding(false);
    } catch {
      toast.error("Failed to add milestone");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleComplete = async (m: Milestone) => {
    try {
      const updated = await goalsApi.updateMilestone(m.id, { completed: !m.completed });
      setMilestones((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch {
      toast.error("Failed to update milestone");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await goalsApi.deleteMilestone(id);
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    } catch {
      toast.error("Failed to delete milestone");
    }
  };

  if (loading) {
    return <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-2">
      {milestones.length === 0 && !adding && (
        <p className="text-sm text-gray-400 text-center py-2">No milestones yet</p>
      )}

      {milestones.map((m) => (
        <div key={m.id} className="flex items-start gap-2 group">
          <button
            onClick={() => toggleComplete(m)}
            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              m.completed
                ? "border-green-500 bg-green-500 text-white"
                : "border-gray-300 dark:border-gray-600 hover:border-green-400"
            }`}
          >
            {m.completed && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${m.completed ? "line-through text-gray-400" : "text-gray-900 dark:text-white"}`}>
              {m.title}
            </p>
            {m.description && <p className="text-xs text-gray-500 truncate">{m.description}</p>}
            {m.dueDate && (
              <p className="text-xs text-gray-400 mt-0.5">
                Due {new Date(m.dueDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            onClick={() => handleDelete(m.id)}
            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {adding ? (
        <form onSubmit={handleAdd} className="space-y-2 mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <input
            autoFocus
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Milestone title"
            className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)"
            className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-md hover:bg-brand-700 disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setForm({ title: "", description: "", dueDate: "" }); }}
              className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-1.5 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 font-medium border border-dashed border-brand-300 dark:border-brand-700 rounded-lg hover:border-brand-500 transition-colors"
        >
          + Add milestone
        </button>
      )}
    </div>
  );
}
