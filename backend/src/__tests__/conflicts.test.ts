import { detectConflicts, isInformational, findAlternativeSlot } from "../utils/conflicts";

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
