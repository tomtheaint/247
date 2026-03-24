import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Modal } from "../UI/Modal";
import { Button } from "../UI/Button";
import { Input } from "../UI/Input";
import { useGoalStore } from "../../store/goalStore";
import { useTrackStore } from "../../store/trackStore";
import { tracksApi } from "../../api/tracks";
import type { Track, Goal, GoalCategory, TrackDifficulty } from "../../types";

const CATEGORIES: GoalCategory[] = ["FITNESS", "LEARNING", "CAREER", "HEALTH", "CREATIVE", "SOCIAL", "FINANCE", "OTHER"];
const DIFFICULTIES: TrackDifficulty[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

interface SelectedGoal {
  id: string;
  title: string;
  icon: string;
  color: string;
  order: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  track?: Track | null;
}

export function TrackModal({ open, onClose, onSaved, track }: Props) {
  const { goals: allGoals, fetch: fetchGoals } = useGoalStore();
  const { fetchMine } = useTrackStore();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "OTHER" as GoalCategory,
    difficulty: "BEGINNER" as TrackDifficulty,
    estimatedDays: 30,
    isPublic: false,
  });
  const [selectedGoals, setSelectedGoals] = useState<SelectedGoal[]>([]);
  const [saving, setSaving] = useState(false);
  const [goalSearch, setGoalSearch] = useState("");

  useEffect(() => {
    if (open) {
      fetchGoals();
      if (track) {
        setForm({
          title: track.title,
          description: track.description,
          category: track.category,
          difficulty: track.difficulty,
          estimatedDays: track.estimatedDays,
          isPublic: track.isPublic,
        });
        const existing = (track.goals ?? [])
          .map((g, i) => ({ id: g.id, title: g.title, icon: g.icon, color: g.color, order: g.trackGoalOrder ?? i }))
          .sort((a, b) => a.order - b.order);
        setSelectedGoals(existing);
      } else {
        setForm({ title: "", description: "", category: "OTHER", difficulty: "BEGINNER", estimatedDays: 30, isPublic: false });
        setSelectedGoals([]);
      }
      setGoalSearch("");
    }
  }, [open, track, fetchGoals]);

  const availableGoals = allGoals.filter(
    (g) =>
      !selectedGoals.some((s) => s.id === g.id) &&
      (goalSearch === "" || g.title.toLowerCase().includes(goalSearch.toLowerCase()))
  );

  const addGoal = (goal: Goal) => {
    setSelectedGoals((prev) => [
      ...prev,
      { id: goal.id, title: goal.title, icon: goal.icon, color: goal.color, order: prev.length },
    ]);
    setGoalSearch("");
  };

  const removeGoal = (id: string) => {
    setSelectedGoals((prev) =>
      prev.filter((g) => g.id !== id).map((g, i) => ({ ...g, order: i }))
    );
  };

  const moveGoal = (id: string, dir: -1 | 1) => {
    setSelectedGoals((prev) => {
      const idx = prev.findIndex((g) => g.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr.map((g, i) => ({ ...g, order: i }));
    });
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      let savedTrack: Track;
      if (track) {
        savedTrack = await tracksApi.update(track.id, form);
      } else {
        savedTrack = await tracksApi.create(form);
      }
      await tracksApi.setGoals(savedTrack.id, selectedGoals.map((g, i) => ({ id: g.id, order: i })));
      await fetchMine();
      toast.success(track ? "Track updated" : "Track created");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to save track");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={track ? "Edit Track" : "New Track"} size="lg">
      <div className="space-y-5">
        <Input
          label="Title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Track title"
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            placeholder="What is this track about?"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 resize-none dark:text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as GoalCategory }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:text-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Difficulty</label>
            <select
              value={form.difficulty}
              onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value as TrackDifficulty }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:text-white"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Estimated days"
            type="number"
            min={1}
            value={form.estimatedDays}
            onChange={(e) => setForm((f) => ({ ...f, estimatedDays: +e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Visibility</label>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2.5">
              <span className="text-sm text-gray-700 dark:text-gray-300">Public</span>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, isPublic: !f.isPublic }))}
                className={`relative w-10 h-6 rounded-full transition-colors ${form.isPublic ? "bg-brand-600" : "bg-gray-300 dark:bg-gray-600"}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isPublic ? "translate-x-4" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Goals section */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Goals</span>
            <span className="text-xs text-gray-400">{selectedGoals.length} selected</span>
          </div>

          {selectedGoals.length > 0 && (
            <div className="space-y-1.5">
              {selectedGoals.map((g, i) => (
                <div key={g.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-xs text-gray-400 w-5 text-center font-mono shrink-0">{i + 1}</span>
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0"
                    style={{ backgroundColor: g.color + "22", border: `1.5px solid ${g.color}55` }}
                  >
                    {g.icon}
                  </div>
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{g.title}</span>
                  <div className="flex gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveGoal(g.id, -1)}
                      disabled={i === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 rounded"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveGoal(g.id, 1)}
                      disabled={i === selectedGoals.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 rounded"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGoal(g.id)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <Input
              placeholder="Search goals to add..."
              value={goalSearch}
              onChange={(e) => setGoalSearch(e.target.value)}
            />
            {availableGoals.length > 0 && goalSearch !== "" && (
              <div className="mt-1.5 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {availableGoals.slice(0, 8).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => addGoal(g)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors text-left border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs"
                      style={{ backgroundColor: g.color + "22", border: `1.5px solid ${g.color}55` }}
                    >
                      {g.icon}
                    </span>
                    <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{g.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                      g.status === "COMPLETED"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                    }`}>
                      {g.status.toLowerCase()}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {goalSearch !== "" && availableGoals.length === 0 && (
              <p className="text-xs text-gray-400 mt-1.5">No matching goals found</p>
            )}
            {goalSearch === "" && availableGoals.length > 0 && (
              <p className="text-xs text-gray-400 mt-1.5">Type to search and add goals from your library</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="button" onClick={handleSave} loading={saving} className="flex-1">
            {track ? "Save Changes" : "Create Track"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
