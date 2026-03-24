import { addDays, startOfDay } from "../utils/dates";

describe("date utilities", () => {
  it("addDays adds N days and sets time to 09:00", () => {
    const base = new Date("2024-01-01T00:00:00Z");
    const result = addDays(base, 3);
    expect(result.getDate()).toBe(base.getDate() + 3);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });

  it("startOfDay returns midnight", () => {
    const d = new Date("2024-06-15T14:30:00");
    const sod = startOfDay(d);
    expect(sod.getHours()).toBe(0);
    expect(sod.getMinutes()).toBe(0);
    expect(sod.getSeconds()).toBe(0);
  });
});
