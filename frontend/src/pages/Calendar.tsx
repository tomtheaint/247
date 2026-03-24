import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Calendar, dateFnsLocalizer, Views, type View } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, endOfWeek, startOfDay, endOfDay, getDay, startOfMonth, endOfMonth } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { toast } from "react-hot-toast";
import { useEventStore } from "../store/eventStore";
import { useGoalStore } from "../store/goalStore";
import { useAuthStore } from "../store/authStore";
import { EventModal } from "../components/Calendar/EventModal";
import { schedulingApi } from "../api/scheduling";
import { eventsApi } from "../api/events";
import { usersApi } from "../api/users";
import type { CalendarEvent } from "../types";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { "en-US": enUS },
});

const DnDCalendar = withDragAndDrop(Calendar);

type ConflictDetail = { title: string; startTime: string; endTime: string };

interface RBCEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: CalendarEvent & { conflictDetails?: ConflictDetail[] };
}

function toRBC(e: CalendarEvent, conflictDetails?: ConflictDetail[]): RBCEvent {
  return {
    id: e.id,
    title: e.title,
    start: new Date(e.startTime),
    end: new Date(e.endTime),
    resource: conflictDetails ? { ...e, conflictDetails } : e,
  };
}

// Stable ref shared between CalendarPage and EventTile (same module scope)
const conflictMapsRef = {
  byEvent: {} as Record<string, ConflictDetail[]>,
  byParent: {} as Record<string, ConflictDetail[]>,
  // Per-instance conflict list: only instances with actual event overlaps
  recurInstances: [] as Array<{ parentId: string; startTime: string }>,
};

/** Returns true if this specific recurring instance is in the conflicted list (±60s tolerance). */
function isRecurInstanceConflicted(parentId: string, instanceStart: Date): boolean {
  return conflictMapsRef.recurInstances.some(
    (inst) => inst.parentId === parentId &&
      Math.abs(new Date(inst.startTime).getTime() - instanceStart.getTime()) < 60001
  );
}

const HOLIDAY_DESCRIPTIONS: Record<string, string> = {
  "New Year's Day":              "Marks the start of the new year (January 1).",
  "Martin Luther King Jr. Day":  "Honors civil rights leader Dr. Martin Luther King Jr., observed on the 3rd Monday of January.",
  "Presidents' Day":             "Commemorates U.S. presidents, especially Washington and Lincoln. Observed on the 3rd Monday of February.",
  "Memorial Day":                "Honors military personnel who died in service. Observed on the last Monday of May.",
  "Juneteenth":                  "Commemorates the emancipation of enslaved people in the U.S. (June 19, 1865).",
  "Independence Day":            "Celebrates the Declaration of Independence from Britain (July 4, 1776).",
  "Labor Day":                   "Honors the contributions of workers. Observed on the 1st Monday of September.",
  "Columbus Day":                "Marks Christopher Columbus's 1492 arrival in the Americas. Observed on the 2nd Monday of October.",
  "Veterans Day":                "Honors all U.S. military veterans (November 11).",
  "Thanksgiving Day":            "A national day of giving thanks, observed on the 4th Thursday of November.",
  "Christmas Day":               "Celebrates the birth of Jesus Christ and is widely observed as a cultural holiday (December 25).",
};

// Custom event renderer — shows goal icon, lock badge, and conflict tooltip
function EventTile({ event }: { event: RBCEvent }) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  // Holidays: just show a hover description tooltip, no interaction
  if (event.id.startsWith("holiday_")) {
    const desc = HOLIDAY_DESCRIPTIONS[event.title];
    return (
      <span
        className="truncate font-medium cursor-default select-none"
        onMouseEnter={(e) => desc && setTip({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTip(null)}
      >
        {event.title}
        {tip && desc && createPortal(
          <div
            style={{ position: "fixed", left: tip.x + 12, top: tip.y - 8, transform: "translateY(-100%)", zIndex: 99999 }}
            className="w-64 bg-gray-900 text-white text-xs rounded-xl shadow-2xl p-3 pointer-events-none"
          >
            <p className="font-semibold text-green-300 mb-1">{event.title}</p>
            <p className="text-gray-300 leading-relaxed">{desc}</p>
          </div>,
          document.body
        )}
      </span>
    );
  }

  const icon = event.resource.goal?.icon;
  const locked = event.resource.isLocked;

  // For recurring instances, only treat as conflicted if THIS specific occurrence matches
  const isRecurring = !!event.resource.recurringParentId;
  const instanceConflicted = isRecurring
    ? isRecurInstanceConflicted(event.resource.recurringParentId!, event.start)
    : false;

  const details = !isRecurring
    ? conflictMapsRef.byEvent[event.resource.id]
    : instanceConflicted
      ? conflictMapsRef.byParent[event.resource.recurringParentId!]
      : undefined;
  const hasConflict = !!(details && details.length > 0);

  return (
    <span
      className="flex flex-col min-w-0 leading-tight"
      onMouseEnter={(e) => hasConflict && setTip({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setTip(null)}
    >
      <span className="flex items-center gap-1 truncate">
        {locked && (
          <svg className="w-3 h-3 shrink-0 opacity-80" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        )}
        {icon && <span className="shrink-0 text-xs leading-none">{icon}</span>}
        <span className="truncate font-semibold">{event.title}</span>
        {hasConflict && (
          <span className="shrink-0 leading-none" style={{ fontSize: "0.65rem" }}>❗</span>
        )}
      </span>
      {!event.resource.allDay && (
        <span className="text-xs opacity-75 truncate">
          {format(event.start, "h:mm a")} – {format(event.end, "h:mm a")}
        </span>
      )}
      {tip && details && createPortal(
        <div
          style={{ position: "fixed", left: tip.x + 12, top: tip.y - 8, transform: "translateY(-100%)", zIndex: 99999 }}
          className="w-64 bg-gray-900 text-white text-xs rounded-xl shadow-2xl p-3 pointer-events-none"
        >
          <p className="font-semibold text-red-300 uppercase tracking-wide mb-2">Scheduling conflicts</p>
          <ul className="space-y-1.5">
            {details.map((c, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <svg className="w-3 h-3 text-red-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="min-w-0">
                  <p className="text-gray-100 truncate">{c.title}</p>
                  <p className="text-gray-400">{format(new Date(c.startTime), "EEE MMM d, h:mm a")}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </span>
  );
}

// ─── Conflict banner ──────────────────────────────────────────────────────────

interface ConflictingEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

interface ConflictBannerProps {
  conflictCount: number;
  unresolvableCount: number;
  resolving: boolean;
  viewLabel: string;
  conflictedEvents: ConflictingEvent[];
  onResolveShowing: () => void;
  onResolveAll: () => void;
  onDismiss: () => void;
}

function ConflictBanner({ conflictCount, unresolvableCount, resolving, viewLabel, conflictedEvents, onResolveShowing, onResolveAll, onDismiss }: ConflictBannerProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  if (conflictCount === 0) return null;
  const spinnerIcon = (
    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl text-sm">
      <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div className="flex-1 min-w-0">
        <span
          className="relative font-semibold text-amber-800 dark:text-amber-200 cursor-default underline decoration-dashed underline-offset-2"
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
        >
          {conflictCount} scheduling conflict{conflictCount !== 1 ? "s" : ""} detected
          {tooltipOpen && conflictedEvents.length > 0 && (
            <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 rounded-xl shadow-xl p-3 text-left">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Conflicting events</p>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {conflictedEvents.map((e) => (
                  <li key={e.id} className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{e.title}</p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(e.startTime), "EEE MMM d, h:mm a")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </span>
        {unresolvableCount > 0 ? (
          <span className="ml-2 text-amber-600 dark:text-amber-400">
            — {unresolvableCount} could not be moved (highlighted in red)
          </span>
        ) : (
          <span className="ml-2 text-amber-600 dark:text-amber-400">
            — hover to see details
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onResolveShowing}
          disabled={resolving}
          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
          title={`Fix conflicts in the current ${viewLabel}`}
        >
          {resolving && spinnerIcon}
          Fix {viewLabel}
        </button>
        <button
          onClick={onResolveAll}
          disabled={resolving}
          className="px-3 py-1.5 rounded-lg border border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
          title="Fix all conflicts across all loaded events"
        >
          {resolving && spinnerIcon}
          Fix all
        </button>
        <button
          onClick={onDismiss}
          className="p-1 text-amber-500 hover:text-amber-700 transition-colors"
          title="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Calendar page ─────────────────────────────────────────────────────────────

export function CalendarPage() {
  const { events, fetch, create, update, remove } = useEventStore();
  const { fetch: fetchGoals } = useGoalStore();
  const { user } = useAuthStore();
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();

  // Pending drag-drop for recurring events (shows "move all" vs "move this one" dialog)
  const [pendingDrop, setPendingDrop] = useState<{ event: RBCEvent; start: Date; end: Date } | null>(null);
  const [applyingDrop, setApplyingDrop] = useState(false);

  const [holidays, setHolidays] = useState<RBCEvent[]>([]);
  const [showHolidaysPref, setShowHolidaysPref] = useState(true);

  const [snoozePreview, setSnoozePreview] = useState<{
    eventId: string;
    eventTitle: string;
    current: { startTime: string; endTime: string };
    proposed: { startTime: string; endTime: string } | null;
  } | null>(null);
  const [confirmingSnooze, setConfirmingSnooze] = useState(false);

  // Conflict state
  const [conflictedIds, setConflictedIds] = useState<Set<string>>(new Set());
  const [conflictedRecurringParentIds, setConflictedRecurringParentIds] = useState<Set<string>>(new Set());
  const [conflictedRecurringInstances, setConflictedRecurringInstances] = useState<Array<{ parentId: string; startTime: string }>>([]);
  const [conflictingByEvent, setConflictingByEvent] = useState<Record<string, ConflictDetail[]>>({});
  const [conflictingByParent, setConflictingByParent] = useState<Record<string, ConflictDetail[]>>({});
  const [unresolvableIds, setUnresolvableIds] = useState<Set<string>>(new Set());
  const [conflictBannerDismissed, setConflictBannerDismissed] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeMenuOpen, setOptimizeMenuOpen] = useState(false);
  const rangeRef = useRef<{ start: string; end: string } | null>(null);
  const optimizeRef = useRef<HTMLDivElement>(null);

  const loadEvents = useCallback(
    async (d: Date) => {
      // Compute the actual view edges so cross-month weeks are fully covered
      const viewStart = view === Views.MONTH ? startOfMonth(d)
                      : view === Views.DAY   ? startOfDay(d)
                      : startOfWeek(d, { weekStartsOn: 0 });
      const viewEnd   = view === Views.MONTH ? endOfMonth(d)
                      : view === Views.DAY   ? endOfDay(d)
                      : endOfWeek(d, { weekStartsOn: 0 });
      // Expand to full month boundaries so adjacent-month events load too
      const start = startOfMonth(viewStart).toISOString();
      const end   = endOfMonth(viewEnd).toISOString();
      rangeRef.current = { start, end };
      await fetch(start, end);
    },
    [fetch, view]
  );

  const checkConflicts = useCallback(async () => {
    if (!rangeRef.current) return;
    const { start, end } = rangeRef.current;
    try {
      const { conflictedIds: ids, conflictedRecurringParentIds: parentIds, conflictedRecurringInstances: recurInst, conflictingByParent: byParent, conflictingByEvent: byEvent } = await schedulingApi.getConflicts(start, end);
      setConflictedIds(new Set(ids));
      setConflictedRecurringParentIds(new Set(parentIds));
      setConflictedRecurringInstances(recurInst ?? []);
      setConflictingByEvent(byEvent ?? {});
      setConflictingByParent(byParent ?? {});
      // Keep module ref in sync for EventTile access
      conflictMapsRef.byEvent = byEvent ?? {};
      conflictMapsRef.byParent = byParent ?? {};
      conflictMapsRef.recurInstances = recurInst ?? [];
      if (ids.length > 0 || parentIds.length > 0) setConflictBannerDismissed(false);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  useEffect(() => {
    // Fetch showHolidays preference (auth/me doesn't include it)
    usersApi.getMe().then((u) => {
      setShowHolidaysPref((u as unknown as Record<string, unknown>).showHolidays !== false);
    }).catch(() => {});

    // Compute US federal holidays locally — always on their canonical calendar dates.
    // (External APIs return "observed" dates which shift holidays when they fall on weekends.)
    const year = new Date().getFullYear();
    const getNth = (y: number, month: number, weekday: number, nth: number) => {
      const d = new Date(y, month, 1);
      const offset = (weekday - d.getDay() + 7) % 7;
      d.setDate(1 + offset + (nth - 1) * 7);
      return d;
    };
    const getLast = (y: number, month: number, weekday: number) => {
      const d = new Date(y, month + 1, 0); // last day of month
      d.setDate(d.getDate() - ((d.getDay() - weekday + 7) % 7));
      return d;
    };
    const fedHolidays: Array<{ date: Date; name: string }> = [
      { date: new Date(year, 0, 1),   name: "New Year's Day" },
      { date: getNth(year, 0, 1, 3),  name: "Martin Luther King Jr. Day" },
      { date: getNth(year, 1, 1, 3),  name: "Presidents' Day" },
      { date: getLast(year, 4, 1),    name: "Memorial Day" },
      { date: new Date(year, 5, 19),  name: "Juneteenth" },
      { date: new Date(year, 6, 4),   name: "Independence Day" },
      { date: getNth(year, 8, 1, 1),  name: "Labor Day" },
      { date: getNth(year, 9, 1, 2),  name: "Columbus Day" },
      { date: new Date(year, 10, 11), name: "Veterans Day" },
      { date: getNth(year, 10, 4, 4), name: "Thanksgiving Day" },
      { date: new Date(year, 11, 25), name: "Christmas Day" },
    ];
    setHolidays(
      fedHolidays.map(({ date, name }) => {
        const y = date.getFullYear(), mo = date.getMonth(), d = date.getDate();
        const dayStart = new Date(y, mo, d);
        // RBC all-day end is exclusive: set to midnight of the *next* day.
        const dayEnd = new Date(y, mo, d + 1);
        const dateKey = `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        return {
          id: `holiday_${dateKey}`,
          title: name,
          start: dayStart,
          end: dayEnd,
          allDay: true,
          resource: {
            id: `holiday_${dateKey}`,
            title: name,
            startTime: dayStart.toISOString(),
            endTime: dayStart.toISOString(),
            allDay: true,
            isLocked: false,
            userId: "",
            createdAt: "",
          } as CalendarEvent,
        };
      })
    );
  }, []);

  useEffect(() => {
    if (!optimizeMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (optimizeRef.current && !optimizeRef.current.contains(e.target as Node)) {
        setOptimizeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [optimizeMenuOpen]);

  useEffect(() => {
    loadEvents(date).then(() => checkConflicts());
  }, [loadEvents, date, checkConflicts]);

  const handleOptimize = async (scope: "day" | "week" | "month") => {
    setOptimizeMenuOpen(false);
    setOptimizing(true);
    try {
      const start =
        scope === "day"   ? startOfDay(date).toISOString() :
        scope === "week"  ? startOfWeek(date, { weekStartsOn: 0 }).toISOString() :
                            startOfMonth(date).toISOString();
      const end =
        scope === "day"   ? endOfDay(date).toISOString() :
        scope === "week"  ? endOfWeek(date, { weekStartsOn: 0 }).toISOString() :
                            endOfMonth(date).toISOString();

      const result = await schedulingApi.optimize(start, end);
      if (result.optimized > 0) {
        toast.success(`Rearranged ${result.optimized} event${result.optimized !== 1 ? "s" : ""} to fit your schedule`);
      } else if (result.unresolvableRecurring.length > 0) {
        toast(`Schedule is otherwise optimal, but ${result.unresolvableRecurring.length} recurring event${result.unresolvableRecurring.length !== 1 ? "s" : ""} conflict${result.unresolvableRecurring.length === 1 ? "s" : ""} — edit them manually`);
      } else {
        toast.success("Schedule is already optimal");
      }
      if (result.unplaceable.length > 0) {
        setUnresolvableIds(new Set(result.unplaceable));
        toast.error(`${result.unplaceable.length} event${result.unplaceable.length !== 1 ? "s" : ""} couldn't be placed — highlighted in red`);
      } else {
        setUnresolvableIds(new Set());
      }
      await loadEvents(date);
      await checkConflicts();
    } catch {
      toast.error("Optimization failed");
    } finally {
      setOptimizing(false);
    }
  };

  const handleTakeDayOff = async () => {
    setOptimizeMenuOpen(false);
    setOptimizing(true);
    try {
      const result = await schedulingApi.takeDayOff(startOfDay(date).toISOString());
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
      await loadEvents(date);
      await checkConflicts();
    } catch {
      toast.error("Take Day Off failed");
    } finally {
      setOptimizing(false);
    }
  };

  const handleSnooze = async (id: string) => {
    const eventObj = events.find((e) => e.id === id);
    try {
      const preview = await schedulingApi.previewSnooze(id);
      setModalOpen(false);
      setSnoozePreview({
        eventId: id,
        eventTitle: eventObj?.title ?? "Event",
        current: preview.current,
        proposed: preview.proposed,
      });
    } catch {
      toast.error("Couldn't preview snooze");
    }
  };

  const confirmSnooze = async () => {
    if (!snoozePreview) return;
    setConfirmingSnooze(true);
    try {
      const updated = await schedulingApi.snooze(snoozePreview.eventId);
      await loadEvents(date);
      await checkConflicts();
      toast.success(`Snoozed to ${format(new Date(updated.startTime), "EEE MMM d 'at' h:mm a")}`);
    } catch {
      toast.error("Snooze failed — no free slot found");
    } finally {
      setConfirmingSnooze(false);
      setSnoozePreview(null);
    }
  };

  /** Returns the [start, end] ISO strings for the currently visible view. */
  const getVisibleRange = (): { start: string; end: string } => {
    if (view === Views.DAY) {
      return { start: startOfDay(date).toISOString(), end: endOfDay(date).toISOString() };
    }
    if (view === Views.MONTH) {
      return { start: startOfMonth(date).toISOString(), end: endOfMonth(date).toISOString() };
    }
    // week (default)
    return {
      start: startOfWeek(date, { weekStartsOn: 0 }).toISOString(),
      end:   endOfWeek(date,   { weekStartsOn: 0 }).toISOString(),
    };
  };

  const viewLabel = view === Views.DAY ? "day" : view === Views.MONTH ? "month" : "week";

  const handleAutoResolve = async (scope: "showing" | "all") => {
    setResolving(true);
    try {
      const { start, end } = scope === "showing" ? getVisibleRange() : rangeRef.current!;
      const result = await schedulingApi.resolveConflicts(start, end);

      if (result.resolved > 0) {
        toast.success(`Moved ${result.resolved} event${result.resolved !== 1 ? "s" : ""} to better time slots`);
      } else {
        toast.success("No movable conflicts found in this range");
      }
      if (result.unresolvable.length > 0) {
        toast.error(`${result.unresolvable.length} event${result.unresolvable.length !== 1 ? "s" : ""} couldn't be moved — no free slots found`);
        setUnresolvableIds(new Set(result.unresolvable));
      }
      if (result.unresolvableRecurring.length > 0) {
        toast.error(`${result.unresolvableRecurring.length} recurring event${result.unresolvableRecurring.length !== 1 ? "s" : ""} conflict — edit them from the Recurring Events page`);
      }

      await loadEvents(date);
      await checkConflicts();
    } catch {
      toast.error("Auto-fix failed");
    } finally {
      setResolving(false);
    }
  };

  const handleSelectSlot = ({ start }: { start: Date }) => {
    setEditing(null);
    setDefaultStart(start);
    setModalOpen(true);
  };

  const handleSelectEvent = (e: RBCEvent) => {
    // Holidays are display-only — no modal
    if (e.id.startsWith("holiday_")) return;

    const resource = e.resource;
    // Recurring instances have a synthetic id like "parentId_0". Resolve to the parent
    // so edits/deletes operate on the real DB record.
    if (resource.recurringParentId) {
      setEditing({ ...resource, id: resource.recurringParentId });
    } else {
      setEditing(resource);
    }
    setDefaultStart(undefined);
    setModalOpen(true);
  };

  const handleEventDrop = async ({ event, start, end }: { event: RBCEvent; start: Date; end: Date }) => {
    if (event.id.startsWith("holiday_")) return;
    if (event.resource.recurringParentId) {
      // Recurring instance — ask before committing
      setPendingDrop({ event, start, end });
      return;
    }
    try {
      await update(event.id, { startTime: start.toISOString(), endTime: end.toISOString() });
      await loadEvents(date);
      await checkConflicts();
    } catch {
      toast.error("Failed to move event");
    }
  };

  const applyDrop = async (mode: "all" | "this") => {
    if (!pendingDrop) return;
    const { event, start, end } = pendingDrop;
    const parentId = event.resource.recurringParentId!;
    setApplyingDrop(true);
    try {
      if (mode === "all") {
        const deltaMs = start.getTime() - event.start.getTime();
        await eventsApi.update(parentId, { deltaMs });
        toast.success("All occurrences moved");
      } else {
        await eventsApi.detachInstance(parentId, event.start.toISOString(), start.toISOString(), end.toISOString());
        toast.success("This occurrence moved");
      }
      setPendingDrop(null);
      await loadEvents(date);
      await checkConflicts();
    } catch {
      toast.error("Failed to move event");
    } finally {
      setApplyingDrop(false);
    }
  };

  const handleSave = async (data: Partial<CalendarEvent>) => {
    try {
      if (editing) {
        await update(editing.id, data);
        toast.success("Event updated");
      } else {
        await create(data);
        toast.success("Event created");
      }
      // Always reload so recurring instances are re-expanded at their new times
      await loadEvents(date);
      await checkConflicts();
    } catch {
      toast.error("Failed to save event");
    }
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    setConflictedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setUnresolvableIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    toast.success("Event deleted");
    await checkConflicts();
  };

  const slotPropGetter = (slotDate: Date) => {
    if (!user?.wakeTimeWeekday) return {};
    const dow = slotDate.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const wakeStr  = isWeekend ? user.wakeTimeWeekend  : user.wakeTimeWeekday;
    const sleepStr = isWeekend ? user.sleepTimeWeekend : user.sleepTimeWeekday;
    const wakeHour  = parseInt((wakeStr  ?? "07:00").split(":")[0], 10);
    const sleepHour = parseInt((sleepStr ?? "23:00").split(":")[0], 10);
    const hour = slotDate.getHours();
    if (hour < wakeHour || hour >= sleepHour) {
      return { style: { backgroundColor: "rgba(0,0,0,0.045)" } };
    }
    return {};
  };

  const eventPropGetter = (e: RBCEvent) => {
    if (e.id.startsWith("holiday_")) {
      return {
        style: {
          backgroundColor: "#f0fdf4",
          border: "1px solid #86efac",
          borderRadius: "4px",
          color: "#166534",
          fontSize: "0.7rem",
        },
      };
    }
    const isUnresolvable = unresolvableIds.has(e.id);
    const isConflicted = conflictedIds.has(e.id) ||
      !!(e.resource.recurringParentId && conflictedRecurringInstances.some(
        (inst) => inst.parentId === e.resource.recurringParentId &&
          Math.abs(new Date(inst.startTime).getTime() - e.start.getTime()) < 60001
      ));
    const isLocked = e.resource.isLocked;
    const baseColor = e.resource.goal?.color ?? e.resource.color ?? "#6366f1";

    return {
      style: {
        backgroundColor: isUnresolvable ? "transparent" : isConflicted ? "#ef444455" : baseColor,
        border: isUnresolvable || isConflicted
          ? "2px solid #ef4444"
          : isLocked
          ? "2px solid #f59e0b"
          : "none",
        borderRadius: "6px",
        color: isUnresolvable ? "#ef4444" : "#fff",
        fontWeight: isConflicted || isUnresolvable || isLocked ? 600 : 400,
        opacity: isLocked ? 0.92 : 1,
      },
    };
  };

  const visibleConflicts = conflictedIds.size + conflictedRecurringParentIds.size;
  const visibleUnresolvable = unresolvableIds.size;
  const conflictedEvents = events
    .filter((e) => {
      if (!e.recurringParentId) return conflictedIds.has(e.id);
      // Only include this specific instance if its start time matches a known conflicted instance
      return conflictedRecurringInstances.some(
        (inst) => inst.parentId === e.recurringParentId &&
          Math.abs(new Date(inst.startTime).getTime() - new Date(e.startTime).getTime()) < 60001
      );
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 20); // cap tooltip at 20 entries

  const showHolidays = showHolidaysPref;
  const calendarEvents = [
    ...events.map((e) => {
      const details = conflictingByEvent[e.id] ??
        (e.recurringParentId ? conflictingByParent[e.recurringParentId] : undefined);
      return toRBC(e, details);
    }),
    ...(showHolidays ? holidays : []),
  ];

  return (
    <div className="flex flex-col h-full p-3 sm:p-6 gap-3 sm:gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadEvents(date).then(() => checkConflicts())}
            title="Refresh events"
            className="p-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:border-brand-500 hover:text-brand-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {/* Optimize button with day/week dropdown */}
          <div className="relative" ref={optimizeRef}>
            <button
              onClick={() => setOptimizeMenuOpen((v) => !v)}
              disabled={optimizing}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:border-brand-500 hover:text-brand-600 transition-colors disabled:opacity-50"
            >
              {optimizing ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span className="hidden sm:inline">Optimize</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {optimizeMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 overflow-hidden">
                {view !== Views.MONTH && (
                  <>
                    <button
                      onClick={() => handleOptimize("day")}
                      className="w-full px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="font-medium">Optimize Day</div>
                      <div className="text-xs text-gray-400">{format(date, "EEE, MMM d")}</div>
                    </button>
                    <div className="border-t border-gray-100 dark:border-gray-700" />
                  </>
                )}
                {view === Views.MONTH ? (
                  <button
                    onClick={() => handleOptimize("month")}
                    className="w-full px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="font-medium">Optimize Month</div>
                    <div className="text-xs text-gray-400">{format(date, "MMMM yyyy")}</div>
                  </button>
                ) : (
                  <button
                    onClick={() => handleOptimize("week")}
                    className="w-full px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="font-medium">Optimize Week</div>
                    <div className="text-xs text-gray-400">
                      {format(startOfWeek(date, { weekStartsOn: 0 }), "MMM d")} – {format(endOfWeek(date, { weekStartsOn: 0 }), "MMM d")}
                    </div>
                  </button>
                )}
                <div className="border-t border-gray-100 dark:border-gray-700" />
                <button
                  onClick={handleTakeDayOff}
                  className="w-full px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="font-medium">Take Day Off</div>
                  <div className="text-xs text-gray-400">{format(date, "EEE, MMM d")}</div>
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => { setEditing(null); setDefaultStart(new Date()); setModalOpen(true); }}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            + Add Event
          </button>
        </div>
      </div>

      {!conflictBannerDismissed && (
        <ConflictBanner
          conflictCount={visibleConflicts}
          unresolvableCount={visibleUnresolvable}
          resolving={resolving}
          viewLabel={viewLabel}
          conflictedEvents={conflictedEvents}
          onResolveShowing={() => handleAutoResolve("showing")}
          onResolveAll={() => handleAutoResolve("all")}
          onDismiss={() => setConflictBannerDismissed(true)}
        />
      )}

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 min-h-0">
        <DnDCalendar
          localizer={localizer}
          events={calendarEvents}
          view={view}
          date={date}
          onView={setView}
          onNavigate={(d) => { setDate(d); setConflictBannerDismissed(false); }}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent as never}
          onEventDrop={handleEventDrop as never}
          onEventResize={handleEventDrop as never}
          selectable
          resizable
          eventPropGetter={eventPropGetter as never}
          slotPropGetter={slotPropGetter as never}
          components={{ event: EventTile as never }}
          style={{ height: "100%" }}
          popup
        />
      </div>

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        onSnooze={handleSnooze}
        event={editing}
        defaultStart={defaultStart}
      />

      {pendingDrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Move recurring event</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              <span className="font-medium text-gray-800 dark:text-gray-200">"{pendingDrop.event.title}"</span> is a recurring event.
              Do you want to move just this occurrence, or all occurrences in the series?
            </p>
            <div className="space-y-2">
              <button
                disabled={applyingDrop}
                onClick={() => applyDrop("this")}
                className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors disabled:opacity-50"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">Move this occurrence only</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Only {format(pendingDrop.event.start, "EEE MMM d")} moves. The rest of the series stays the same.
                </p>
              </button>
              <button
                disabled={applyingDrop}
                onClick={() => applyDrop("all")}
                className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors disabled:opacity-50"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">Move all occurrences</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Every event in this series shifts by the same amount.
                </p>
              </button>
            </div>
            <button
              onClick={() => setPendingDrop(null)}
              disabled={applyingDrop}
              className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            {applyingDrop && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-400">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving…
              </div>
            )}
          </div>
        </div>
      )}

      {snoozePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Reschedule event?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              <span className="font-medium text-gray-800 dark:text-gray-200">"{snoozePreview.eventTitle}"</span>
            </p>
            <div className="space-y-2 mb-6">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Current time</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {format(new Date(snoozePreview.current.startTime), "EEE MMM d 'at' h:mm a")} – {format(new Date(snoozePreview.current.endTime), "h:mm a")}
                </p>
              </div>
              {snoozePreview.proposed ? (
                <div className="rounded-xl border border-brand-200 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/20 p-3">
                  <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide mb-1">Move to</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {format(new Date(snoozePreview.proposed.startTime), "EEE MMM d 'at' h:mm a")} – {format(new Date(snoozePreview.proposed.endTime), "h:mm a")}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">No available slot found in the next 14 days.</p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSnoozePreview(null)}
                className="flex-1 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              {snoozePreview.proposed && (
                <button
                  disabled={confirmingSnooze}
                  onClick={confirmSnooze}
                  className="flex-1 py-2 text-sm font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {confirmingSnooze ? "Moving…" : "Confirm"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
