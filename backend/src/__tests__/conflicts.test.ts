import { detectConflicts, isInformational, findAlternativeSlot, conflictsWithSleep, wakeWindow } from "../utils/conflicts";

const prefs = {
  wakeTimeWeekday: "07:00",
  sleepTimeWeekday: "23:00",
  wakeTimeWeekend: "07:00",
  sleepTimeWeekend: "23:00",
  chronotype: "MID_DAY",
};

/** A Wednesday, well inside the waking window, so only overlap is in play. */
function ev(id: string, startHour: number, hours = 1, priority?: string) {
  return {
    id,
    startTime: new Date(`2024-06-12T${String(startHour).padStart(2, "0")}:00:00Z`),
    endTime: new Date(`2024-06-12T${String(startHour + hours).padStart(2, "0")}:00:00Z`),
    goalId: null,
    priority,
  };
}

describe("informational events", () => {
  it("is recognised by priority alone", () => {
    expect(isInformational(ev("a", 9, 1, "INFORMATIONAL"))).toBe(true);
    expect(isInformational(ev("b", 9, 1, "NORMAL"))).toBe(false);
    expect(isInformational(ev("c", 9))).toBe(false);
  });

  it("two ordinary events that overlap still conflict", () => {
    // The guard against a fix that simply switches conflict detection off.
    const conflicted = detectConflicts([ev("a", 9, 2), ev("b", 10, 2)], prefs);
    expect([...conflicted].sort()).toEqual(["a", "b"]);
  });

  it("does not conflict with an event it overlaps", () => {
    const conflicted = detectConflicts([ev("work", 9, 2), ev("birthday", 9, 2, "INFORMATIONAL")], prefs);
    expect(conflicted.size).toBe(0);
  });

  it("does not make the events underneath it conflict with each other", () => {
    // The direction that matters most: an all-day informational event overlaps
    // everything, and must not turn a clear day into eight conflicts.
    const allDay = {
      id: "conference",
      startTime: new Date("2024-06-12T00:00:00Z"),
      endTime: new Date("2024-06-13T00:00:00Z"),
      goalId: null,
      priority: "INFORMATIONAL",
    };
    const conflicted = detectConflicts([allDay, ev("a", 9), ev("b", 11), ev("c", 14)], prefs);
    expect(conflicted.size).toBe(0);
  });

  it("is never itself reported as conflicted, even outside waking hours", () => {
    const overnight = { ...ev("flight", 2, 3, "INFORMATIONAL") };
    const conflicted = detectConflicts([overnight], prefs);
    expect(conflicted.has("flight")).toBe(false);
  });

  it("an ordinary event outside waking hours still conflicts", () => {
    expect(detectConflicts([ev("late", 2, 3)], prefs).has("late")).toBe(true);
  });

  it("does not flag a recurring occurrence it happens to cover", () => {
    /*
     * The reported case, and the one the tests above miss entirely.
     *
     * A weekly appointment expands into occurrences, and those are matched by a
     * second overlap scan in the conflicts endpoint rather than by
     * detectConflicts. Everything here was already correct while the calendar
     * still went red, because the rule had not reached that scan.
     */
    const allDay = {
      id: "payday",
      startTime: new Date("2024-06-12T00:00:00Z"),
      endTime: new Date("2024-06-13T00:00:00Z"),
      goalId: null,
      priority: "INFORMATIONAL",
    };
    const occurrence = { ...ev("__recur_0__", 9, 3), priority: null };
    expect(detectConflicts([allDay, occurrence], prefs).size).toBe(0);
  });

  it("is not treated as occupied space when rescheduling", () => {
    // Booking work during a birthday is fine; the birthday is not a commitment.
    const moving = ev("task", 9);
    const blocked = ev("birthday", 10, 8, "INFORMATIONAL");
    const slot = findAlternativeSlot(moving, 3600000, [moving, blocked], prefs);
    expect(slot).not.toBeNull();
    // Overlapping it is the whole point. Asserting merely that the slot lands
    // before the block ends is not enough: the scheduler will happily pick an
    // hour *earlier* than the block and satisfy that while still avoiding it,
    // which is the behaviour this is supposed to rule out.
    const overlapsBlock =
      slot!.startTime < blocked.endTime && slot!.endTime > blocked.startTime;
    expect(overlapsBlock).toBe(true);
  });
});

describe("a waking window that runs past midnight", () => {
  /** The reported setup: up at 07:30, asleep at half past midnight. */
  const nightOwl = {
    wakeTimeWeekday: "07:30",
    sleepTimeWeekday: "00:30",
    wakeTimeWeekend: "08:00",
    sleepTimeWeekend: "01:00",
    chronotype: "NIGHT_OWL",
  };

  /** A Wednesday, so the weekday times apply. */
  function at(startHour: number, startMin: number, hours: number) {
    const start = new Date(`2024-06-12T${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}:00Z`);
    return {
      id: `e${startHour}`,
      startTime: start,
      endTime: new Date(start.getTime() + hours * 3600000),
      goalId: null,
    };
  }

  it("leaves an ordinary evening alone", () => {
    // The reported symptom: a 6:10pm event flagged "outside sleep/wake window"
    // because 00:30 read as hour 0, so everything ended after bedtime.
    expect(conflictsWithSleep(at(18, 10, 1), nightOwl)).toBe(false);
    expect(conflictsWithSleep(at(9, 0, 2), nightOwl)).toBe(false);
    expect(conflictsWithSleep(at(23, 0, 1), nightOwl)).toBe(false);
  });

  it("still knows when somebody is asleep", () => {
    expect(conflictsWithSleep(at(3, 0, 1), nightOwl)).toBe(true);
    expect(conflictsWithSleep(at(6, 0, 1), nightOwl)).toBe(true);
    // Running past bedtime, rather than starting after it.
    expect(conflictsWithSleep(at(23, 45, 2), nightOwl)).toBe(true);
  });

  it("counts the minutes, not just the hour", () => {
    // 00:30 truncated to hour 0 lost half an hour of somebody's evening.
    expect(conflictsWithSleep(at(23, 30, 0.75), nightOwl)).toBe(false);
    expect(conflictsWithSleep(at(23, 30, 1.25), nightOwl)).toBe(true);
  });

  it("does not disturb an ordinary window", () => {
    const early = { ...nightOwl, wakeTimeWeekday: "07:00", sleepTimeWeekday: "23:00" };
    expect(conflictsWithSleep(at(9, 0, 1), early)).toBe(false);
    expect(conflictsWithSleep(at(6, 0, 1), early)).toBe(true);
    expect(conflictsWithSleep(at(22, 30, 1), early)).toBe(true);
  });

  it("reports the window it will use", () => {
    expect(wakeWindow(nightOwl, false)).toEqual({ wake: 7.5, sleep: 24.5 });
    expect(wakeWindow(nightOwl, true)).toEqual({ wake: 8, sleep: 25 });
    // An ordinary one is left exactly as written.
    expect(wakeWindow({ ...nightOwl, wakeTimeWeekday: "07:00", sleepTimeWeekday: "23:00" }, false))
      .toEqual({ wake: 7, sleep: 23 });
  });

  it("gives the scheduler somewhere to put things", () => {
    // With the window read literally there were no legal hours at all, so
    // auto-fix silently had nowhere to move anything to.
    const slot = findAlternativeSlot(at(3, 0, 1), 3600000, [at(3, 0, 1)], nightOwl);
    expect(slot).not.toBeNull();
    expect(conflictsWithSleep({ ...at(0, 0, 1), ...slot!, id: "x", goalId: null }, nightOwl)).toBe(false);
  });
});
