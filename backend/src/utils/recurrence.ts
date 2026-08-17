export interface RecurrenceRule {
  freq: "daily" | "weekly" | "monthly";
  interval?: number;
  daysOfWeek?: number[]; // 0=Sun … 6=Sat
  daysFilter?: "all" | "weekdays" | "weekends"; // for daily freq
  endDate?: string;
  count?: number;
  excludeDates?: string[]; // ISO date strings (YYYY-MM-DD) to skip
}

interface EventBase {
  startTime: Date;
  endTime: Date;
  recurrence: unknown;
}

interface ExpandedInstance {
  startTime: Date;
  endTime: Date;
  recurringParentId?: string;
}

export function expandRecurring(
  event: EventBase & { id: string },
  rangeStart: Date,
  rangeEnd: Date
): ExpandedInstance[] {
  const rule = event.recurrence as RecurrenceRule;
  if (!rule?.freq) return [];

  const instances: ExpandedInstance[] = [];
  const interval = rule.interval ?? 1;
  const durationMs = event.endTime.getTime() - event.startTime.getTime();
  /*
   * "Ends on the 3rd" includes the 3rd.
   *
   * A bare date parses as midnight, so an occurrence at any time of day on the
   * final date was past the end and dropped — a series that visibly stopped one
   * occurrence early, and only for people who end a rule on a day it falls on.
   */
  const hardEnd = rule.endDate
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(rule.endDate) ? `${rule.endDate}T23:59:59.999Z` : rule.endDate)
    : rangeEnd;
  const maxCount = rule.count ?? 500;

  /*
   * A weekly rule with several days on it has to be walked a day at a time.
   *
   * Stepping a week at a time only ever lands on the weekday the series began
   * on, so the other days in `daysOfWeek` were never even examined: "every week
   * on Tue, Wed, Thu and Fri" quietly meant "every Tuesday". The rule was
   * stored correctly and displayed correctly; only the expansion disagreed,
   * which is why it could go unnoticed.
   */
  const weeklyByDay = rule.freq === "weekly" && !!rule.daysOfWeek?.length;
  /*
   * Which week a moment falls in, counted from the week the series started.
   *
   * Anchored to a Sunday rather than to the epoch: dividing the timestamp by
   * seven days puts the boundary on a Thursday, because 1 January 1970 was one.
   * Monday and Friday of the same calendar week then land in different "weeks",
   * so every other week on Mon and Fri came out as alternating single days.
   */
  const weekStart = (d: Date) => {
    const x = new Date(d.getTime());
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - x.getDay());
    return x.getTime();
  };
  const anchorWeek = weekStart(event.startTime);
  const weeksSince = (d: Date) => Math.round((weekStart(d) - anchorWeek) / (7 * 86400000));

  let cursor = new Date(event.startTime);
  let produced = 0;
  // Walking daily needs its own stop, since `count` now counts occurrences
  // rather than steps and a long range would otherwise spin.
  let steps = 0;
  const maxSteps = 4000;

  while (cursor <= hardEnd && cursor <= rangeEnd && produced < maxCount && steps < maxSteps) {
    steps++;
    const inRange = cursor >= rangeStart && cursor <= rangeEnd;
    const dow = cursor.getDay();
    const onInterval = weeklyByDay ? weeksSince(cursor) % interval === 0 : true;
    const dayMatch =
      onInterval &&
      (rule.freq !== "weekly" || !rule.daysOfWeek?.length || rule.daysOfWeek.includes(dow)) &&
      (!rule.daysFilter || rule.daysFilter === "all" ||
        (rule.daysFilter === "weekdays" && dow >= 1 && dow <= 5) ||
        (rule.daysFilter === "weekends" && (dow === 0 || dow === 6)));

    const cursorDate = cursor.toISOString().slice(0, 10);
    const excluded = rule.excludeDates?.includes(cursorDate) ?? false;

    if (inRange && dayMatch && !excluded) {
      instances.push({
        startTime: new Date(cursor),
        endTime: new Date(cursor.getTime() + durationMs),
        recurringParentId: event.id,
      });
      produced++;
    }

    // Advance cursor
    if (weeklyByDay) {
      cursor = new Date(cursor.getTime() + 86400000);
    } else if (rule.freq === "daily") {
      cursor = new Date(cursor.getTime() + interval * 86400000);
    } else if (rule.freq === "weekly") {
      cursor = new Date(cursor.getTime() + interval * 7 * 86400000);
    } else if (rule.freq === "monthly") {
      const next = new Date(cursor);
      next.setMonth(next.getMonth() + interval);
      cursor = next;
    }
  }

  return instances;
}

// ─── Goal scheduling ──────────────────────────────────────────────────────────

type Pace = "slow" | "medium" | "fast";
type DayPref = "weekdays" | "weekends" | "both";
type TimePref = "morning" | "afternoon" | "evening";
type Chronotype = "EARLY_BIRD" | "MID_DAY" | "NIGHT_OWL";

const PACE_HOURS: Record<Pace, number> = { slow: 2, medium: 4, fast: 6 };

const TIME_WINDOWS: Record<TimePref, { start: number; end: number }> = {
  morning:   { start: 6,  end: 12 },
  afternoon: { start: 12, end: 17 },
  evening:   { start: 17, end: 22 },
};

// Preferred hour order per chronotype (most preferred first)
const CHRONOTYPE_HOUR_ORDER: Record<Chronotype, number[]> = {
  EARLY_BIRD: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
  MID_DAY:    [10, 11, 12, 13, 14, 9, 15, 8, 16, 7, 17, 18, 19, 20, 6, 21],
  NIGHT_OWL:  [19, 20, 18, 21, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6],
};

function parseHour(hhmm: string): number {
  return parseInt(hhmm.split(":")[0], 10);
}

function isAllowedDay(date: Date, days: DayPref): boolean {
  const dow = date.getDay();
  if (days === "weekdays") return dow >= 1 && dow <= 5;
  if (days === "weekends") return dow === 0 || dow === 6;
  return true;
}

function isWeekend(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() === 6;
}

interface ExistingEvent { startTime: Date; endTime: Date }

function hasConflict(start: Date, end: Date, existing: ExistingEvent[]): boolean {
  return existing.some((e) => start < e.endTime && end > e.startTime);
}

export interface ScheduleSlot { startTime: Date; endTime: Date }

interface UserPrefs {
  wakeTimeWeekday: string;
  sleepTimeWeekday: string;
  wakeTimeWeekend: string;
  sleepTimeWeekend: string;
  chronotype: string;
}

export function generateGoalSlots(opts: {
  pace: Pace;
  eventLengthMinutes: number;
  days: DayPref;
  timeOfDay: TimePref;
  weeks: number;
  existingEvents: ExistingEvent[];
  userPrefs?: UserPrefs;
  tzOffsetMinutes?: number; // minutes returned by getTimezoneOffset(): positive = west of UTC (e.g. UTC-3 → 180)
  timesPerWeekOverride?: number;
}): ScheduleSlot[] {
  const { pace, eventLengthMinutes, days, timeOfDay, weeks, existingEvents, userPrefs, tzOffsetMinutes = 0 } = opts;

  // tzMs: adding this to UTC ms gives local ms (local = UTC - tzOffset)
  const tzMs = tzOffsetMinutes * 60000;

  const hoursPerWeek = PACE_HOURS[pace];
  const sessionsPerWeek = opts.timesPerWeekOverride ?? Math.max(1, Math.round((hoursPerWeek * 60) / eventLengthMinutes));
  const totalSessions = sessionsPerWeek * weeks;
  const requestedWindow = TIME_WINDOWS[timeOfDay];
  const chronotype = (userPrefs?.chronotype ?? "MID_DAY") as Chronotype;

  // Build the ordered list of hours to try within the requested window,
  // sorted by chronotype preference
  const chronoOrder = CHRONOTYPE_HOUR_ORDER[chronotype];
  const hoursToTry = chronoOrder.filter(
    (h) => h >= requestedWindow.start && h + eventLengthMinutes / 60 <= requestedWindow.end
  );

  const slots: ScheduleSlot[] = [];

  // Initialize cursor to the user's local midnight expressed as a UTC timestamp.
  // Local midnight in UTC = floor(now in local ms) rounded to local day start + tzMs.
  const nowLocalMs = Date.now() - tzMs;
  const localMidnightLocalMs = nowLocalMs - (nowLocalMs % 86400000);
  let cursorMs = localMidnightLocalMs + tzMs; // user's local midnight as UTC ms

  let sessionCount = 0;
  let daysScanned = 0;
  const maxDays = weeks * 7 + 30;

  while (sessionCount < totalSessions && daysScanned < maxDays) {
    cursorMs += 86400000; // advance by one calendar day
    daysScanned++;

    // getUTCDay() on a Date set to local midnight gives the user's local day-of-week
    const cursor = new Date(cursorMs);
    const dow = cursor.getUTCDay();

    if (days === "weekdays" && !(dow >= 1 && dow <= 5)) continue;
    if (days === "weekends" && !(dow === 0 || dow === 6)) continue;

    const weekend = dow === 0 || dow === 6;
    const wakeHour  = parseHour(weekend ? (userPrefs?.wakeTimeWeekend  ?? "08:00") : (userPrefs?.wakeTimeWeekday  ?? "07:00"));
    const sleepHour = parseHour(weekend ? (userPrefs?.sleepTimeWeekend ?? "23:00") : (userPrefs?.sleepTimeWeekday ?? "23:00"));

    // Try hours in chronotype-preferred order, respecting wake/sleep
    for (const h of hoursToTry) {
      if (h < wakeHour) continue;
      if (h + eventLengthMinutes / 60 > sleepHour) continue;

      // cursorMs = user's local midnight as UTC ms
      // local h:00 in UTC = cursorMs + h * 3600000
      const start = new Date(cursorMs + h * 3600000);
      const end = new Date(start.getTime() + eventLengthMinutes * 60000);

      if (!hasConflict(start, end, existingEvents) && !hasConflict(start, end, slots)) {
        slots.push({ startTime: start, endTime: end });
        sessionCount++;
        break;
      }
    }
  }

  return slots;
}
