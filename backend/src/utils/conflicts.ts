interface SlimEvent {
  id: string;
  startTime: Date;
  endTime: Date;
  goalId: string | null;
  isLocked?: boolean;
}

interface UserPrefs {
  wakeTimeWeekday: string;
  sleepTimeWeekday: string;
  wakeTimeWeekend: string;
  sleepTimeWeekend: string;
  chronotype: string;
}

function parseHour(hhmm: string): number {
  return parseInt(hhmm.split(":")[0], 10);
}

/**
 * Returns local midnight as a UTC Date.
 * tzOffsetMinutes = new Date().getTimezoneOffset() on the client
 *   (positive = west of UTC, e.g. EST = 300)
 */
function getLocalMidnight(utcDate: Date, tzOffsetMinutes: number): Date {
  const localMs = utcDate.getTime() - tzOffsetMinutes * 60000;
  const dayFloor = Math.floor(localMs / 86400000) * 86400000;
  return new Date(dayFloor + tzOffsetMinutes * 60000);
}

/** Get local weekday (0=Sun…6=Sat) from a UTC Date */
function getLocalWeekday(utcDate: Date, tzOffsetMinutes: number): number {
  const localMs = utcDate.getTime() - tzOffsetMinutes * 60000;
  return new Date(localMs).getUTCDay();
}

/** Get local hour (0-23) from a UTC Date */
function getLocalHour(utcDate: Date, tzOffsetMinutes: number): number {
  const localMs = utcDate.getTime() - tzOffsetMinutes * 60000;
  return new Date(localMs).getUTCHours();
}

/** True if two events overlap in time */
export function overlaps(a: SlimEvent, b: SlimEvent): boolean {
  return a.startTime < b.endTime && a.endTime > b.startTime;
}

/**
 * True if an event falls outside the user's wake/sleep window.
 * Timezone-aware: pass tzOffsetMinutes from the client.
 */
export function conflictsWithSleep(event: SlimEvent, prefs: UserPrefs, tzOffsetMinutes = 0): boolean {
  const localWeekday = getLocalWeekday(event.startTime, tzOffsetMinutes);
  const weekend = localWeekday === 0 || localWeekday === 6;
  const wake  = parseHour(weekend ? prefs.wakeTimeWeekend  : prefs.wakeTimeWeekday);
  const sleep = parseHour(weekend ? prefs.sleepTimeWeekend : prefs.sleepTimeWeekday);
  const startH = getLocalHour(event.startTime, tzOffsetMinutes);
  const endH   = getLocalHour(event.endTime,   tzOffsetMinutes) + (event.endTime.getMinutes() > 0 ? 1 : 0);
  return startH < wake || endH > sleep;
}

/**
 * Returns the set of event IDs that are in conflict.
 * An event is "conflicted" if:
 *  - it overlaps with another event, OR
 *  - it falls outside the user's wake/sleep window
 */
export function detectConflicts(events: SlimEvent[], prefs: UserPrefs, tzOffsetMinutes = 0): Set<string> {
  const conflicted = new Set<string>();

  for (const ev of events) {
    if (conflictsWithSleep(ev, prefs, tzOffsetMinutes)) conflicted.add(ev.id);
  }

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      if (overlaps(events[i], events[j])) {
        conflicted.add(events[i].id);
        conflicted.add(events[j].id);
      }
    }
  }

  return conflicted;
}

// ─── Chronotype hour preference order ────────────────────────────────────────
const CHRONOTYPE_ORDER: Record<string, number[]> = {
  EARLY_BIRD: [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21],
  MID_DAY:    [10,11,12,13,14,9,15,8,16,7,17,18,19,20,6,21],
  NIGHT_OWL:  [19,20,18,21,17,16,15,14,13,12,11,10,9,8,7,6],
};

/**
 * Find a new non-conflicting slot for a single event (used by auto-fix / resolveConflicts).
 * Picks the first free hour in chronotype-preference order, starting from the event's
 * original day and expanding up to maxDaysAhead.
 * Timezone-aware: pass tzOffsetMinutes = new Date().getTimezoneOffset() from the client.
 */
export function findAlternativeSlot(
  event: SlimEvent,
  durationMs: number,
  allEvents: SlimEvent[],
  prefs: UserPrefs,
  tzOffsetMinutes = 0,
  maxDaysAhead = 7,
): { startTime: Date; endTime: Date } | null {
  const chronoOrder = CHRONOTYPE_ORDER[prefs.chronotype] ?? CHRONOTYPE_ORDER.MID_DAY;
  const others = allEvents.filter((e) => e.id !== event.id);
  const originalLocalHour = getLocalHour(event.startTime, tzOffsetMinutes);

  for (let dayOffset = 0; dayOffset <= maxDaysAhead; dayOffset++) {
    // Compute the local midnight for this day offset
    const baseDay = getLocalMidnight(event.startTime, tzOffsetMinutes);
    const day = new Date(baseDay.getTime() + dayOffset * 86400000);

    const localWeekday = getLocalWeekday(day, tzOffsetMinutes);
    const weekend = localWeekday === 0 || localWeekday === 6;
    const wake  = parseHour(weekend ? prefs.wakeTimeWeekend  : prefs.wakeTimeWeekday);
    const sleep = parseHour(weekend ? prefs.sleepTimeWeekend : prefs.sleepTimeWeekday);

    for (const h of chronoOrder) {
      if (h < wake) continue;
      if (h + durationMs / 3600000 > sleep) continue;
      // Skip the exact original slot
      if (dayOffset === 0 && h === originalLocalHour) continue;

      // day is local midnight in UTC → adding h hours gives local hour h
      const candidate    = new Date(day.getTime() + h * 3600000);
      const candidateEnd = new Date(candidate.getTime() + durationMs);

      const stub = { id: "__candidate__", startTime: candidate, endTime: candidateEnd, goalId: event.goalId };
      if (!others.some((o) => overlaps(stub, o)) && !conflictsWithSleep(stub, prefs, tzOffsetMinutes)) {
        return { startTime: candidate, endTime: candidateEnd };
      }
    }
  }
  return null;
}

/**
 * Find the best slot for an event within a given date range.
 * Prioritises minimal movement: tries the exact original time first, then
 * hours sorted by proximity to the original hour, on the original day first
 * then other days in the range.
 *
 * Timezone-aware: rangeStart must be local midnight in UTC
 * (send startOfDay(date).toISOString() from the frontend).
 * tzOffsetMinutes = new Date().getTimezoneOffset() on the client.
 */
export function findBestSlot(
  event: { startTime: Date; endTime: Date },
  durationMs: number,
  occupied: { startTime: Date; endTime: Date }[],
  prefs: UserPrefs,
  rangeStart: Date,
  rangeEnd: Date,
  tzOffsetMinutes = 0,
): { startTime: Date; endTime: Date } | null {
  const originalHour = getLocalHour(event.startTime, tzOffsetMinutes);
  const originalDay  = getLocalMidnight(event.startTime, tzOffsetMinutes);

  // Collect local-midnight days within the range
  const allDaysInRange: Date[] = [];
  const cur = new Date(rangeStart.getTime());
  while (cur.getTime() <= rangeEnd.getTime()) {
    allDaysInRange.push(new Date(cur.getTime()));
    cur.setTime(cur.getTime() + 86400000);
  }

  // Original day first, then remaining days in chronological order
  const daysToTry = [
    originalDay,
    ...allDaysInRange.filter((d) => d.getTime() !== originalDay.getTime()),
  ];

  for (const day of daysToTry) {
    const localWeekday = getLocalWeekday(day, tzOffsetMinutes);
    const weekend = localWeekday === 0 || localWeekday === 6;
    const wake  = parseHour(weekend ? prefs.wakeTimeWeekend  : prefs.wakeTimeWeekday);
    const sleep = parseHour(weekend ? prefs.sleepTimeWeekend : prefs.sleepTimeWeekday);

    // All valid hours for this day, sorted by distance from original hour.
    // This keeps moves as small as possible rather than snapping to chronotype.
    const hoursToTry = Array.from({ length: 24 }, (_, i) => i)
      .filter((h) => h >= wake && h + durationMs / 3600000 <= sleep)
      .sort((a, b) => Math.abs(a - originalHour) - Math.abs(b - originalHour));

    for (const h of hoursToTry) {
      // day is local midnight in UTC → adding h hours gives local hour h
      const candidate    = new Date(day.getTime() + h * 3600000);
      const candidateEnd = new Date(candidate.getTime() + durationMs);

      if (candidate.getTime() < rangeStart.getTime() || candidate.getTime() > rangeEnd.getTime()) continue;

      if (!occupied.some((o) => candidate < o.endTime && candidateEnd > o.startTime)) {
        return { startTime: candidate, endTime: candidateEnd };
      }
    }
  }
  return null;
}

/**
 * Find the next available slot starting from the day AFTER the event.
 * Used for snooze / "skip for today" functionality.
 */
export function findNextAvailableSlot(
  event: { startTime: Date; endTime: Date },
  durationMs: number,
  occupied: { startTime: Date; endTime: Date }[],
  prefs: UserPrefs,
  tzOffsetMinutes = 0,
  maxDays = 14,
): { startTime: Date; endTime: Date } | null {
  const eventLocalMidnight = getLocalMidnight(event.startTime, tzOffsetMinutes);
  const nextLocalMidnight  = new Date(eventLocalMidnight.getTime() + 86400000);
  const rangeEnd = new Date(nextLocalMidnight.getTime() + maxDays * 86400000);

  return findBestSlot(event, durationMs, occupied, prefs, nextLocalMidnight, rangeEnd, tzOffsetMinutes);
}
