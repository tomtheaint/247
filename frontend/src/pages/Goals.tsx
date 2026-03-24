import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useGoalStore } from "../store/goalStore";
import { GoalCard } from "../components/Goals/GoalCard";
import { GoalModal } from "../components/Goals/GoalModal";
import { GoalScheduleModal } from "../components/Goals/GoalScheduleModal";
import { Button } from "../components/UI/Button";
import type { Goal } from "../types";

export function GoalsPage() {
  const { goals, isLoading, fetch, create, update, remove } = useGoalStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [scheduling, setScheduling] = useState<Goal | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [confirmDelete, setConfirmDelete] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = filter === "ALL" ? goals : goals.filter((g) => g.status === filter);

  const handleSave = async (data: Partial<Goal>) => {
    try {
      if (editing) {
        await update(editing.id, data);
        toast.success("Goal updated");
      } else {
        await create(data);
        toast.success("Goal created");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const handleDelete = (id: string) => {
    const goal = goals.find((g) => g.id === id);
    if (goal) setConfirmDelete(goal);
  };

  const executeDelete = async (deleteEvents: boolean) => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await remove(confirmDelete.id, deleteEvents);
      toast.success(deleteEvents ? "Goal and events deleted" : "Goal deleted");
      setConfirmDelete(null);
    } catch {
      toast.error("Failed to delete goal");
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (goal: Goal) => { setEditing(goal); setModalOpen(true); };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Goals</h1>
          <p className="text-gray-500 text-sm mt-1">{goals.length} goals total</p>
        </div>
        <Button onClick={openCreate}>+ New Goal</Button>
      </div>

      <div className="flex gap-2 mb-6">
        {["ALL", "ACTIVE", "COMPLETED", "PAUSED", "ARCHIVED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50"}`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onEdit={openEdit} onDelete={handleDelete} onSchedule={setScheduling} onComplete={(id, status) => update(id, { status })} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <p className="text-lg mb-2">No goals found</p>
              <Button onClick={openCreate} size="sm">Create your first goal</Button>
            </div>
          )}
        </div>
      )}

      <GoalModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        goal={editing}
      />

      {scheduling && (
        <GoalScheduleModal
          open={!!scheduling}
          onClose={() => setScheduling(null)}
          goal={scheduling}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete goal?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Do you also want to delete all calendar events associated with{" "}
              <span className="font-medium text-gray-800 dark:text-gray-200">"{confirmDelete.title}"</span>?
            </p>
            <div className="space-y-2">
              <button
                disabled={deleting}
                onClick={() => executeDelete(true)}
                className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">Delete goal and all events</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Removes the goal and every session scheduled for it.</p>
              </button>
              <button
                disabled={deleting}
                onClick={() => executeDelete(false)}
                className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">Delete goal only</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Keeps existing calendar events but removes the goal.</p>
              </button>
            </div>
            <button
              onClick={() => setConfirmDelete(null)}
              disabled={deleting}
              className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
