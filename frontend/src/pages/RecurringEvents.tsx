import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import { eventsApi } from "../api/events";
import { schedulingApi } from "../api/scheduling";
import { Button } from "../components/UI/Button";
import { EventModal } from "../components/Calendar/EventModal";
import type { CalendarEvent } from "../types";

type ConflictDetail = { title: string; startTime: string; endTime: string };

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatRecurrence(rec: Record<string, unknown> | null | undefined): string {
  if (!rec || !rec.freq) return "—";
  const freq = rec.freq as string;
  const interval = (rec.interval as number) ?? 1;
  const daysOfWeek = rec.daysOfWeek as number[] | undefined;
  const daysFilter = rec.daysFilter as string | undefined;

  if (freq === "daily") {
    let label = interval === 1 ? "Daily" : `Every ${interval} days`;
    if (daysFilter === "weekdays") label += " · weekdays only";
    else if (daysFilter === "weekends") label += " · weekends only";
    return label;
  }
  if (freq === "weekly") {
    let label = interval === 1 ? "Weekly" : `Every ${interval} weeks`;
    if (daysOfWeek && daysOfWeek.length > 0) {
      const sorted = [...daysOfWeek].sort((a, b) => a - b);
      label += ` · ${sorted.map((d) => DAY_NAMES[d]).join(", ")}`;
    }
    return label;
  }
  if (freq === "monthly") {
    return interval === 1 ? "Monthly" : `Every ${interval} months`;
  }
  return freq;
}

function formatTimeRange(startTime: string, endTime: string): string {
  return `${format(new Date(startTime), "h:mm a")} – ${format(new Date(endTime), "h:mm a")}`;
}

function formatEndDate(rec: Record<string, unknown> | null | undefined): string {
  if (!rec || !rec.endDate) return "Never";
  return format(new Date(rec.endDate as string), "MMM d, yyyy");
}

export function RecurringEventsPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CalendarEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [conflictingByParent, setConflictingByParent] = useState<Record<string, ConflictDetail[]>>({});
  const [tooltipId, setTooltipId] = useState<string | null>(null);

  const loadConflicts = async () => {
    try {
      const now = new Date().toISOString();
      const future = new Date(Date.now() + 365 * 86400000).toISOString();
      const { conflictingByParent: details } = await schedulingApi.getConflicts(now, future);
      setConflictingByParent(details);
    } catch {
      // non-critical
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await eventsApi.listRecurring();
      setEvents(data);
    } catch {
      toast.error("Failed to load recurring events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadConflicts();
  }, []);

  const handleSave = async (data: Partial<CalendarEvent>) => {
    if (!editing) return;
    await eventsApi.update(editing.id, data);
    toast.success("Recurring event updated");
    await load();
    await loadConflicts();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await eventsApi.delete(confirmDelete.id);
      toast.success("Recurring event and all its instances deleted");
      setConfirmDelete(null);
      await load();
      await loadConflicts();
    } catch {
      toast.error("Failed to delete event");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = events.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    (e.goal?.title ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recurring Events</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all your repeating events in one place.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:text-white w-48"
          />
          <Button variant="secondary" size="sm" onClick={() => { load(); loadConflicts(); }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-16 text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {search ? "No recurring events match your search." : "No recurring events yet."}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Create recurring events from the <a href="/calendar" className="text-brand-600 hover:underline">Calendar</a>.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 items-center px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <span className="w-2" />
            <span>Event</span>
            <span className="hidden sm:block min-w-[160px]">Repeats</span>
            <span className="hidden md:block min-w-[130px]">Time</span>
            <span className="hidden lg:block min-w-[110px]">Ends</span>
            <span>Actions</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {filtered.map((ev) => {
              const rec = ev.recurrence as Record<string, unknown> | null | undefined;
              const conflicts = conflictingByParent[ev.id] ?? [];
              const hasConflict = conflicts.length > 0;
              return (
                <div
                  key={ev.id}
                  className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 items-center px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  {/* Color dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: ev.goal?.color ?? ev.color ?? "#6366f1" }}
                  />

                  {/* Title + goal */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {ev.isLocked && (
                        <svg className="inline w-3 h-3 mr-1 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      {ev.goal?.icon ? `${ev.goal.icon} ` : ""}{ev.title}
                    </p>
                    {ev.goal && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{ev.goal.title}</p>
                    )}
                    {/* Mobile-only recurrence summary */}
                    <p className="sm:hidden text-xs text-gray-400 mt-0.5">{formatRecurrence(rec)}</p>
                  </div>

                  {/* Repeats */}
                  <span className="hidden sm:block text-sm text-gray-600 dark:text-gray-300 min-w-[160px]">
                    {formatRecurrence(rec)}
                  </span>

                  {/* Time */}
                  <span className="hidden md:block text-sm text-gray-600 dark:text-gray-300 min-w-[130px] tabular-nums">
                    {formatTimeRange(ev.startTime, ev.endTime)}
                  </span>

                  {/* Ends */}
                  <span className="hidden lg:block text-sm text-gray-400 min-w-[110px]">
                    {formatEndDate(rec)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Conflict indicator */}
                    {hasConflict && (
                      <div className="relative">
                        <button
                          onMouseEnter={() => setTooltipId(ev.id)}
                          onMouseLeave={() => setTooltipId(null)}
                          className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="This recurring event has scheduling conflicts"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <circle cx="10" cy="10" r="10" />
                          </svg>
                        </button>
                        {tooltipId === ev.id && (
                          <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 rounded-xl shadow-xl p-3 text-left pointer-events-none">
                            <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">Scheduling conflicts</p>
                            <ul className="space-y-1.5">
                              {conflicts.map((c, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <svg className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{c.title}</p>
                                    <p className="text-xs text-gray-400">{format(new Date(c.startTime), "EEE MMM d, h:mm a")}</p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                            <p className="text-xs text-gray-400 mt-2">Edit this event to resolve conflicts.</p>
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => setEditing(ev)}
                      title="Edit this recurring event"
                      className="p-2 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setConfirmDelete(ev)}
                      title="Delete this recurring event chain"
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
            {filtered.length} recurring event{filtered.length !== 1 ? "s" : ""}
            {search && events.length !== filtered.length ? ` (${events.length} total)` : ""}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <EventModal
          open
          event={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onDelete={async (id) => {
            setEditing(null);
            setConfirmDelete(events.find((e) => e.id === id) ?? null);
          }}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete recurring event?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              <span className="font-medium text-gray-800 dark:text-gray-200">"{confirmDelete.title}"</span> repeats{" "}
              {formatRecurrence(confirmDelete.recurrence as Record<string, unknown> | null | undefined)}.
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mb-6">
              This will permanently delete the entire chain — all past and future instances.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" loading={deleting} onClick={handleDelete}>
                Delete all
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
