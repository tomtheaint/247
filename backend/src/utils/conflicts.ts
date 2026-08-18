interface SlimEvent {
  id: string;
  startTime: Date;
  endTime: Date;
  goalId: string | null;
  isLocked?: boolean;
  priority?: string | null;
}

/**
 * An event that is on the calendar to be seen, not to be done.
 *
 * It never clashes with anything and nothing clashes with it, in both
 * directions: an all-day "Dad's birthday" that only counted as a conflict for
 * the eight meetings underneath it would be worse than not being able to record
 * it at all. For the same reason the schedulers below do not treat one as
 * occupied space — refusing to book work during a birthday would make it a
 * commitment, which is exactly what it is not.
 */
export function isInformational(event: SlimEvent): boolean {
  return event.priority === "INFORMATIONAL";
}

interface UserPrefs {
  wakeTimeWeekday: string;
  sleepTimeWeekday: string;
  wakeTimeWeekend: string;
  sleepTimeWeekend: string;
  chronotype: string;
}

/** "07:30" as 7.5. Minutes matter: a sleep time of 00:30 is not midnight. */
function parseTime(hhmm: string): number {
  const [h, m] = String(hhmm ?? "").split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) + (Number.isFinite(m) ? m / 60 : 0);
}

/**
 * The hours a person is awake, as a window that may run past midnight.
 *
 * Someone who sleeps at half past midnight is awake from 07:30 to 24:30, not
 * from 07:30 to 00:30 — which is an empty window, and read literally it made
 * every event on the calendar a conflict with sleep and left the scheduler with
 * nowhere at all to put anything.
 *
 * Returned in hours from the start of the waking day, so the end may be more
 * than 24. Everything compared against it is measured the same way.
 */
export function wakeWindow(prefs: UserPrefs, weekend: boolean): { wake: number; sleep: number } {
  const wake = parseTime(weekend ? prefs.wakeTimeWeekend : prefs.wakeTimeWeekday);
  const sleep = parseTime(weekend ? prefs.sleepTimeWeekend : prefs.sleepTimeWeekday);
  // Sleeping at or before waking means the next day, which is what a night owl
  // is describing when they say half past midnight.
  return { wake, sleep: sleep <= wake ? sleep + 24 : sleep };
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
  const { wake, sleep } = wakeWindow(prefs, weekend);

  /*
   * The end measured from the start, not from its own clock face.
   *
   * An event running 23:00 to 00:30 ends at hour 0, which compared against a
   * window is earlier than it began. Adding its length to its start keeps it on
   * the same scale as a window that runs past midnight.
   */
  const startH = getLocalHour(event.startTime, tzOffsetMinutes) + event.startTime.getMinutes() / 60;
  const endH = startH + (event.endTime.getTime() - event.startTime.getTime()) / 3600000;
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
  const real = events.filter((e) => !isInformational(e));

  for (const ev of real) {
    if (conflictsWithSleep(ev, prefs, tzOffsetMinutes)) conflicted.add(ev.id);
  }

  for (let i = 0; i < real.length; i++) {
    for (let j = i + 1; j < real.length; j++) {
      if (overlaps(real[i], real[j])) {
        conflicted.add(real[i].id);
        conflicted.add(real[j].id);
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
  const others = allEvents.filter((e) => e.id !== event.id && !isInformational(e));
  const originalLocalHour = getLocalHour(event.startTime, tzOffsetMinutes);

  for (let dayOffset = 0; dayOffset <= maxDaysAhead; dayOffset++) {
    // Compute the local midnight for this day offset
    const baseDay = getLocalMidnight(event.startTime, tzOffsetMinutes);
    const day = new Date(baseDay.getTime() + dayOffset * 86400000);

    const localWeekday = getLocalWeekday(day, tzOffsetMinutes);
    const weekend = localWeekday === 0 || localWeekday === 6;
    const { wake, sleep } = wakeWindow(prefs, weekend);

    for (const h of chronoOrder) {
      /*
       * Candidate hours are hours of this calendar day, so the sliver of a
       * waking window that runs past midnight is not offered for a new session
       * — a night owl who sleeps at half past midnight will not be booked into
       * that half hour. It is still not treated as a conflict, which was the
       * actual complaint; placing something there is a smaller question than
       * teaching slot search to straddle two days.
       */
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
    const { wake, sleep } = wakeWindow(prefs, weekend);

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
