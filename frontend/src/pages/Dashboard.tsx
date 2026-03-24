import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format, startOfWeek, endOfWeek, startOfDay } from "date-fns";
import { toast } from "react-hot-toast";
import { useAuthStore } from "../store/authStore";
import { useGoalStore } from "../store/goalStore";
import { useEventStore } from "../store/eventStore";
import { CategoryBadge } from "../components/UI/Badge";
import { Button } from "../components/UI/Button";
import { GoalDetailModal } from "../components/Goals/GoalDetailModal";
import { schedulingApi } from "../api/scheduling";
import { eventsApi } from "../api/events";
import type { Goal, CalendarEvent } from "../types";

export function DashboardPage() {
  const { user } = useAuthStore();
  const { goals, fetch: fetchGoals } = useGoalStore();
  const { events, fetch: fetchEvents } = useEventStore();
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [confirmDayOff, setConfirmDayOff] = useState(false);
  const [takingDayOff, setTakingDayOff] = useState(false);
  const [snoozingId, setSnoozingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const refetch = async () => {
    const now = new Date();
    await Promise.all([
      fetchGoals(),
      fetchEvents(startOfWeek(now).toISOString(), endOfWeek(now).toISOString()),
    ]);
  };

  useEffect(() => { refetch(); }, []);

  const activeGoals = goals.filter((g) => g.status === "ACTIVE");
  const todayEvents = events.filter((e) => {
    const d = new Date(e.startTime);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const goalEventsToday = todayEvents.filter((e) => e.goalId && !e.isRecurring);
  const pendingGoalEvents = goalEventsToday.filter((e) => !e.isCompleted);

  const handleToggleComplete = async (ev: CalendarEvent) => {
    setTogglingId(ev.id);
    try {
      await eventsApi.update(ev.id, { isCompleted: !ev.isCompleted });
      await refetch();
    } catch {
      toast.error("Failed to update event");
    } finally {
      setTogglingId(null);
    }
  };

  const handleMarkAllComplete = async () => {
    if (pendingGoalEvents.length === 0) return;
    setMarkingAll(true);
    try {
      await Promise.all(pendingGoalEvents.map((e) => eventsApi.update(e.id, { isCompleted: true })));
      await refetch();
      toast.success(`Marked ${pendingGoalEvents.length} session${pendingGoalEvents.length !== 1 ? "s" : ""} as completed`);
    } catch {
      toast.error("Failed to mark all complete");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleTakeDayOff = async () => {
    setTakingDayOff(true);
    try {
      const result = await schedulingApi.takeDayOff(startOfDay(new Date()).toISOString());
      if (result.rescheduled > 0) {
        toast.success(`Moved ${result.rescheduled} of ${result.total} event${result.total !== 1 ? "s" : ""} to later slots`);
      } else if (result.total === 0) {
        toast.success("No events today — enjoy your day off!");
      } else {
        toast("Nothing could be moved");
      }
      if (result.unschedulable.length > 0) {
        toast.error(`${result.unschedulable.length} event${result.unschedulable.length !== 1 ? "s" : ""} couldn't be rescheduled`);
      }
      await refetch();
    } catch {
      toast.error("Take Day Off failed");
    } finally {
      setTakingDayOff(false);
    }
  };

  const handleSnooze = async (ev: CalendarEvent) => {
    if (ev.isLocked) return;
    setSnoozingId(ev.id);
    try {
      const updated = await schedulingApi.snooze(ev.id);
      toast.success(`Snoozed to ${format(new Date(updated.startTime), "EEE MMM d 'at' h:mm a")}`);
      await refetch();
    } catch {
      toast.error("Snooze failed — no free slot found in the next 14 days");
    } finally {
      setSnoozingId(null);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"},{" "}
          {user?.displayName ?? user?.username} 👋
        </h1>
        <p className="text-gray-500 mt-1">{format(new Date(), "EEEE, MMMM d")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Active Goals", value: activeGoals.length, to: "/goals", color: "bg-brand-600" },
          { label: "Events This Week", value: events.length, to: "/calendar", color: "bg-emerald-500" },
          { label: "Today's Events", value: todayEvents.length, to: "/calendar", color: "bg-amber-500" },
        ].map(({ label, value, to, color }) => (
          <Link key={label} to={to} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
            <div className={`inline-flex w-10 h-10 ${color} rounded-lg items-center justify-center text-white font-bold text-lg mb-3`}>{value}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Goals */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Active Goals</h2>
            <Link to="/goals"><Button variant="ghost" size="sm">View all</Button></Link>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {activeGoals.slice(0, 5).map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGoal(g)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block">{g.title}</span>
                  {g._count && g._count.events > 0 && (
                    <div className="mt-1 w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1">
                      <div
                        className="h-1 rounded-full transition-all"
                        style={{
                          width: `${Math.round(((g.completedEventsCount ?? 0) / g._count.events) * 100)}%`,
                          backgroundColor: g.color,
                        }}
                      />
                    </div>
                  )}
                </div>
                <CategoryBadge category={g.category} />
              </button>
            ))}
            {activeGoals.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-400">
                No active goals yet.{" "}
                <Link to="/goals" className="text-brand-600 hover:underline">Create one</Link>
              </div>
            )}
          </div>
        </div>

        {/* Today */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Today</h2>
            <div className="flex items-center gap-2">
              {pendingGoalEvents.length > 0 && (
                <Button variant="secondary" size="sm" loading={markingAll} onClick={handleMarkAllComplete}>
                  Mark all done
                </Button>
              )}
              {todayEvents.length > 0 && (
                <Button variant="secondary" size="sm" loading={takingDayOff} onClick={() => setConfirmDayOff(true)} title="Reschedule all of today's events to later dates">
                  Day off
                </Button>
              )}
              <Link to="/calendar"><Button variant="ghost" size="sm">Calendar</Button></Link>
            </div>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {todayEvents.map((e) => (
              <div key={e.id} className="flex items-start gap-3 p-4">
                {e.goalId && !e.isRecurring ? (
                  <button
                    onClick={() => handleToggleComplete(e)}
                    disabled={togglingId === e.id}
                    className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                      e.isCompleted
                        ? "bg-green-500 border-green-500"
                        : "border-gray-300 dark:border-gray-600 hover:border-green-400"
                    }`}
                    title={e.isCompleted ? "Mark incomplete" : "Mark complete"}
                  >
                    {e.isCompleted && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ) : (
                  <div className="mt-0.5 w-4 h-4 shrink-0" />
                )}
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: e.goal?.color ?? "#6366f1" }} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${e.isCompleted ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-200"}`}>
                    {e.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(e.startTime), "h:mm a")} – {format(new Date(e.endTime), "h:mm a")}
                  </p>
                </div>
                {!e.isLocked && !e.isRecurring && (
                  <button
                    onClick={() => handleSnooze(e)}
                    disabled={snoozingId === e.id}
                    title="Snooze — reschedule to next available slot"
                    className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors disabled:opacity-50"
                  >
                    {snoozingId === e.id ? (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            ))}
            {todayEvents.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-400">
                Nothing scheduled for today.{" "}
                <Link to="/calendar" className="text-brand-600 hover:underline">Add event</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedGoal && (
        <GoalDetailModal goal={selectedGoal} onClose={() => setSelectedGoal(null)} />
      )}

      {confirmDayOff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Take the day off?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              All {todayEvents.length} event{todayEvents.length !== 1 ? "s" : ""} scheduled for today will be moved to the next available slot. Locked events won't be touched.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDayOff(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                loading={takingDayOff}
                onClick={async () => {
                  setConfirmDayOff(false);
                  await handleTakeDayOff();
                }}
              >
                Yes, reschedule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
