import { expandRecurring } from "../utils/recurrence";

const RANGE_START = new Date("2026-08-24T00:00:00Z"); // Monday
const RANGE_END = new Date("2026-09-21T00:00:00Z");

function occurrences(recurrence: unknown, start = "2026-08-25T16:15:00Z", end = RANGE_END) {
  return expandRecurring(
    { id: "e", startTime: new Date(start), endTime: new Date(start), recurrence } as never,
    RANGE_START, end,
  ).map((i) => i.startTime.toISOString().slice(0, 10));
}

describe("expanding recurring events", () => {
  it("produces every chosen weekday, not just the one it started on", () => {
    // Was: a weekly rule stepped a whole week at a time, so Wed/Thu/Fri were
    // never examined and "Tue, Wed, Thu, Fri" silently meant "Tue".
    const days = occurrences({ freq: "weekly", interval: 1, daysOfWeek: [2, 3, 4, 5] },
      "2026-08-25T16:15:00Z", new Date("2026-08-30T00:00:00Z"));
    expect(days).toEqual(["2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"]);
  });

  it("still repeats in following weeks", () => {
    const days = occurrences({ freq: "weekly", interval: 1, daysOfWeek: [1, 5] },
      "2026-08-24T09:00:00Z", new Date("2026-09-07T00:00:00Z"));
    expect(days).toEqual(["2026-08-24", "2026-08-28", "2026-08-31", "2026-09-04"]);
  });

  it("keeps INTERVAL meaning weeks, not days", () => {
    // Every other week on Mon and Fri: the middle week is skipped entirely.
    const days = occurrences({ freq: "weekly", interval: 2, daysOfWeek: [1, 5] },
      "2026-08-24T09:00:00Z", new Date("2026-09-21T00:00:00Z"));
    expect(days).toEqual(["2026-08-24", "2026-08-28", "2026-09-07", "2026-09-11"]);
  });

  it("is unchanged for a single-day weekly rule", () => {
    const days = occurrences({ freq: "weekly", interval: 1, daysOfWeek: [2] },
      "2026-08-25T16:15:00Z", new Date("2026-09-16T00:00:00Z"));
    expect(days).toEqual(["2026-08-25", "2026-09-01", "2026-09-08", "2026-09-15"]);
  });

  it("is unchanged for a weekly rule with no days named", () => {
    const days = occurrences({ freq: "weekly", interval: 1 },
      "2026-08-25T16:15:00Z", new Date("2026-09-16T00:00:00Z"));
    expect(days).toEqual(["2026-08-25", "2026-09-01", "2026-09-08", "2026-09-15"]);
  });

  it("is unchanged for daily rules and their filters", () => {
    expect(occurrences({ freq: "daily", interval: 3 }, "2026-08-25T09:00:00Z",
      new Date("2026-09-04T00:00:00Z"))).toEqual(["2026-08-25", "2026-08-28", "2026-08-31", "2026-09-03"]);
    expect(occurrences({ freq: "daily", daysFilter: "weekends" }, "2026-08-25T09:00:00Z",
      new Date("2026-09-07T00:00:00Z"))).toEqual(["2026-08-29", "2026-08-30", "2026-09-05", "2026-09-06"]);
  });

  it("honours count as a number of occurrences", () => {
    const days = occurrences({ freq: "weekly", interval: 1, daysOfWeek: [2, 3, 4, 5], count: 5 },
      "2026-08-25T16:15:00Z", RANGE_END);
    expect(days).toHaveLength(5);
  });

  it("stops at the rule's end date", () => {
    const days = occurrences({ freq: "weekly", interval: 1, daysOfWeek: [2, 4], endDate: "2026-09-03" },
      "2026-08-25T16:15:00Z", RANGE_END);
    expect(days).toEqual(["2026-08-25", "2026-08-27", "2026-09-01", "2026-09-03"]);
  });

  it("skips excluded dates", () => {
    const days = occurrences({ freq: "weekly", interval: 1, daysOfWeek: [2, 3], excludeDates: ["2026-08-26"] },
      "2026-08-25T16:15:00Z", new Date("2026-09-02T00:00:00Z"));
    expect(days).toEqual(["2026-08-25", "2026-09-01"]);
  });
});
