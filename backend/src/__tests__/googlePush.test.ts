import { asGoogleEvent } from "../services/googlePush";

const base = {
  id: "abc", title: "Standup", description: null,
  startTime: new Date("2026-08-28T13:00:00Z"),
  endTime: new Date("2026-08-28T13:30:00Z"),
  allDay: false, isRecurring: false, recurrence: null,
  syncToGoogle: true, googleEventId: null,
};

describe("the body we send Google", () => {
  it("sends a timed event as instants", () => {
    const body = asGoogleEvent(base) as unknown as Record<string, unknown>;
    expect(body.start).toEqual({ dateTime: "2026-08-28T13:00:00.000Z" });
    expect(body.end).toEqual({ dateTime: "2026-08-28T13:30:00.000Z" });
  });

  it("sends an all-day event as dates, not instants", () => {
    // The mirror image of the import bug: a timestamp here produces the same
    // smear across two days at the other end.
    const body = asGoogleEvent({
      ...base, allDay: true,
      startTime: new Date("2026-08-28T00:00:00Z"),
      endTime: new Date("2026-08-29T00:00:00Z"),
    }) as unknown as Record<string, unknown>;
    expect(body.start).toEqual({ date: "2026-08-28" });
    expect(body.end).toEqual({ date: "2026-08-29" });
  });

  it("carries no recurrence for a one-off", () => {
    expect(asGoogleEvent(base)).not.toHaveProperty("recurrence");
  });

  it("translates a repeating event into an RRULE", () => {
    const body = asGoogleEvent({
      ...base, isRecurring: true,
      recurrence: { freq: "weekly", interval: 2, daysOfWeek: [1, 3], endDate: "2026-12-25" },
    }) as unknown as Record<string, unknown>;
    expect(body.recurrence).toEqual(["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261225T235959Z"]);
  });

  it("omits an absent description rather than sending null", () => {
    expect(asGoogleEvent(base).description).toBeUndefined();
    expect(asGoogleEvent({ ...base, description: "notes" }).description).toBe("notes");
  });
});
