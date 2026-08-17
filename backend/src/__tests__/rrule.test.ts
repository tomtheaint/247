import { toGoogleRecurrence } from "../utils/rrule";

const rule = (r: Record<string, unknown>) => toGoogleRecurrence(r as never)[0];

describe("translating our recurrence rules to RRULE", () => {
  it("says nothing for an event that does not repeat", () => {
    expect(toGoogleRecurrence(null)).toEqual([]);
    expect(toGoogleRecurrence({} as never)).toEqual([]);
  });

  it("handles a plain daily rule", () => {
    expect(rule({ freq: "daily" })).toBe("RRULE:FREQ=DAILY");
    expect(rule({ freq: "daily", interval: 3 })).toBe("RRULE:FREQ=DAILY;INTERVAL=3");
  });

  it("omits INTERVAL=1, which is the default and only noise", () => {
    expect(rule({ freq: "daily", interval: 1 })).toBe("RRULE:FREQ=DAILY");
  });

  it("maps weekdays and weekends onto BYDAY, since RRULE has no daily filter", () => {
    expect(rule({ freq: "daily", daysFilter: "weekdays" })).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    expect(rule({ freq: "daily", daysFilter: "weekends" })).toBe("RRULE:FREQ=WEEKLY;BYDAY=SA,SU");
    // "all" is not a filter, it is the absence of one.
    expect(rule({ freq: "daily", daysFilter: "all" })).toBe("RRULE:FREQ=DAILY");
  });

  it("turns our Sunday-zero weekdays into day codes", () => {
    expect(rule({ freq: "weekly", daysOfWeek: [1, 3, 5] })).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
    expect(rule({ freq: "weekly", daysOfWeek: [0, 6] })).toBe("RRULE:FREQ=WEEKLY;BYDAY=SU,SA");
  });

  it("keeps the interval on a weekly rule, where it means weeks", () => {
    expect(rule({ freq: "weekly", interval: 2, daysOfWeek: [2] })).toBe("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU");
  });

  it("handles monthly", () => {
    expect(rule({ freq: "monthly", interval: 6 })).toBe("RRULE:FREQ=MONTHLY;INTERVAL=6");
  });

  it("ends on the last day inclusive, not at its midnight", () => {
    // Sending UNTIL=...T000000Z would drop the final occurrence.
    expect(rule({ freq: "daily", endDate: "2026-08-28" })).toBe("RRULE:FREQ=DAILY;UNTIL=20260828T235959Z");
    expect(rule({ freq: "weekly", interval: 2, daysOfWeek: [5], endDate: "2026-12-25" }))
      .toBe("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR;UNTIL=20261225T235959Z");
  });

  it("survives a weekly rule with no days chosen", () => {
    // The UI allows it; Google would reject a bare BYDAY=.
    expect(rule({ freq: "weekly" })).toBe("RRULE:FREQ=WEEKLY");
    expect(rule({ freq: "weekly", daysOfWeek: [] })).toBe("RRULE:FREQ=WEEKLY");
  });
});
