import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useTrackStore } from "../store/trackStore";
import { useAuthStore } from "../store/authStore";
import { TrackCard } from "../components/Tracks/TrackCard";
import { GoalHoverCard } from "../components/Goals/GoalHoverCard";
import { GoalDetailModal } from "../components/Goals/GoalDetailModal";
import { Input } from "../components/UI/Input";
import { goalsApi } from "../api/goals";
import type { Goal, GoalCategory, Track, TrackDifficulty } from "../types";

const CATEGORIES: GoalCategory[] = ["FITNESS", "LEARNING", "CAREER", "HEALTH", "CREATIVE", "SOCIAL", "FINANCE", "OTHER"];
const DIFFICULTIES: TrackDifficulty[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

// ─── Public goal card ──────────────────────────────────────────────────────────

function PublicGoalCard({ goal, onView }: { goal: Goal; onView: (g: Goal) => void }) {
  return (
    <div
      className="relative group cursor-pointer bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all"
      onClick={() => onView(goal)}
    >
      <GoalHoverCard goal={goal} />

      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
          style={{ backgroundColor: goal.color + "22", border: `2px solid ${goal.color}44` }}
        >
          {goal.icon || "🎯"}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{goal.title}</h3>
          {goal.user && (
            <p className="text-xs text-gray-400 mt-0.5">by {goal.user.displayName ?? goal.user.username}</p>
          )}
        </div>
      </div>

      {goal.description && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{goal.description}</p>
      )}

      <div className="flex gap-4 mt-3 text-xs text-gray-400">
        {(goal.totalHours ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {goal.totalHours}h
          </span>
        )}
        {(goal._count?.milestones ?? 0) > 0 && (
          <span>{goal._count?.milestones} milestones</span>
        )}
        {(goal._count?.events ?? 0) > 0 && (
          <span>{goal._count?.events} sessions</span>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-700">
        <span className="text-xs text-brand-500 font-medium">View details →</span>
      </div>
    </div>
  );
}

// ─── Community page ────────────────────────────────────────────────────────────

type Tab = "tracks" | "goals";

export function CommunityPage() {
  const { tracks: storeTracts, isLoading: tracksLoading, fetch, adopt } = useTrackStore();
  const { user } = useAuthStore();
  const canManage = user?.role === "ADMIN" || user?.role === "REVIEWER";
  const [tracks, setTracks] = useState(storeTracts);
  const [tab, setTab] = useState<Tab>("tracks");

  // Tracks filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");

  // Goals state
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [goalSearch, setGoalSearch] = useState("");
  const [goalCategory, setGoalCategory] = useState("");
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

  useEffect(() => { setTracks(storeTracts); }, [storeTracts]);

  useEffect(() => {
    if (tab === "tracks") {
      fetch({ q: search || undefined, category: category || undefined, difficulty: difficulty || undefined });
    }
  }, [fetch, tab, search, category, difficulty]);

  const loadGoals = useCallback(async () => {
    setGoalsLoading(true);
    try {
      const res = await goalsApi.listPublic({
        q: goalSearch || undefined,
        category: goalCategory || undefined,
        limit: 50,
      });
      setGoals(res.data);
    } catch {
      toast.error("Failed to load goals");
    } finally {
      setGoalsLoading(false);
    }
  }, [goalSearch, goalCategory]);

  useEffect(() => {
    if (tab === "goals") loadGoals();
  }, [tab, loadGoals]);

  const handleAdopt = async (id: string) => {
    try {
      await adopt(id);
      toast.success("Track adopted! Events added to your calendar.");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to adopt track";
      toast.error(msg);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Community</h1>
        <p className="text-gray-500 text-sm mt-1">Browse tracks and goals shared by the community</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {(["tracks", "goals"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Tracks tab ── */}
      {tab === "tracks" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <Input
              placeholder="Search tracks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:w-64"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:text-white"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
            </select>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:text-white"
            >
              <option value="">All Levels</option>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}
            </select>
          </div>

          {tracksLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="h-56 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tracks.map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  onAdopt={handleAdopt}
                  canManage={canManage}
                  onTrackUpdated={(updated: Track) => setTracks(prev => prev.map(t => t.id === updated.id ? updated : t))}
                  onTrackDeleted={(id: string) => setTracks(prev => prev.filter(t => t.id !== id))}
                />
              ))}
              {tracks.length === 0 && (
                <div className="col-span-3 text-center py-16 text-gray-400">
                  No tracks found. Try adjusting your filters.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Goals tab ── */}
      {tab === "goals" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <Input
              placeholder="Search goals..."
              value={goalSearch}
              onChange={(e) => setGoalSearch(e.target.value)}
              className="sm:w-64"
            />
            <select
              value={goalCategory}
              onChange={(e) => setGoalCategory(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:text-white"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
            </select>
          </div>

          {goalsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="h-44 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {goals.map((goal) => (
                <PublicGoalCard key={goal.id} goal={goal} onView={setSelectedGoal} />
              ))}
              {goals.length === 0 && (
                <div className="col-span-3 text-center py-16 text-gray-400">
                  <p>No public goals yet.</p>
                  <p className="text-sm mt-1">Users can make their goals public in their Goals page.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {selectedGoal && (
        <GoalDetailModal goal={selectedGoal} onClose={() => setSelectedGoal(null)} />
      )}
    </div>
  );
}
