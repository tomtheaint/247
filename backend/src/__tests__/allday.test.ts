import { zonedMidnight } from "../controllers/integrationsController";

/** What a UTC instant reads as on the wall clock in a given zone. */
function wallClock(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(at);
}

describe("Google all-day dates", () => {
  const chicago = "America/Chicago";

  it("lands on midnight of the right day, not the evening before", () => {
    // The reported bug: new Date("2026-08-27") is 7pm on the 26th in Chicago.
    expect(wallClock(new Date("2026-08-27"), chicago)).toBe("2026-08-26, 19:00");
    expect(wallClock(zonedMidnight("2026-08-27", chicago), chicago)).toBe("2026-08-27, 00:00");
  });

  it("spans exactly 24 hours for a one-day event", () => {
    // Google's end.date is exclusive: a single all-day event on the 27th is
    // sent as start 2026-08-27, end 2026-08-28.
    const start = zonedMidnight("2026-08-27", chicago);
    const end = zonedMidnight("2026-08-28", chicago);
    expect(end.getTime() - start.getTime()).toBe(86400000);
  });

  it("is still midnight on the day the clocks go forward", () => {
    // 2026-03-08 is the US spring-forward date; that day is 23 hours long.
    expect(wallClock(zonedMidnight("2026-03-08", chicago), chicago)).toBe("2026-03-08, 00:00");
    const start = zonedMidnight("2026-03-08", chicago);
    const end = zonedMidnight("2026-03-09", chicago);
    expect(end.getTime() - start.getTime()).toBe(23 * 3600000);
  });

  it("is still midnight on the day the clocks go back", () => {
    expect(wallClock(zonedMidnight("2026-11-01", chicago), chicago)).toBe("2026-11-01, 00:00");
    const start = zonedMidnight("2026-11-01", chicago);
    const end = zonedMidnight("2026-11-02", chicago);
    expect(end.getTime() - start.getTime()).toBe(25 * 3600000);
  });

  it("works east of UTC too, where the naive reading lands on the right day", () => {
    // Tokyo is UTC+9, so the old code was off by 9 hours rather than a day —
    // an all-day event that started at 09:00. Wrong in a quieter way.
    expect(wallClock(zonedMidnight("2026-08-27", "Asia/Tokyo"), "Asia/Tokyo")).toBe("2026-08-27, 00:00");
  });
});
