/**
 * Our recurrence rules, written the way Google wants to hear them.
 *
 * One direction only, deliberately. Writing an RRULE from a shape we control is
 * a translation; reading one back is a parser for a specification with decades
 * of accumulated edge cases in it, and nothing here needs that — events created
 * in 247 are the source of truth and Google holds a copy.
 */
import type { RecurrenceRule } from "./recurrence";

/** RFC 5545 day codes, indexed the way JavaScript numbers weekdays. */
const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR"];
const WEEKEND = ["SA", "SU"];

/**
 * `UNTIL` has to be UTC, and it has to include the whole final day.
 *
 * Our end date is a plain "2026-08-28" meaning "up to and including that day".
 * Sending midnight would cut the last occurrence off, which is the kind of
 * off-by-one nobody notices until the series quietly ends a week early.
 */
function until(endDate: string): string {
  const [y, m, d] = endDate.split("-");
  if (!y || !m || !d) return "";
  return `;UNTIL=${y}${m}${d}T235959Z`;
}

/**
 * Returns the RRULE lines for a rule, or an empty array when it does not
 * repeat — which is what Google's `recurrence` field expects either way.
 */
export function toGoogleRecurrence(rule: RecurrenceRule | null | undefined): string[] {
  if (!rule?.freq) return [];

  const interval = rule.interval && rule.interval > 1 ? `;INTERVAL=${rule.interval}` : "";
  const tail = rule.endDate ? until(rule.endDate) : "";

  if (rule.freq === "weekly") {
    const days = (rule.daysOfWeek ?? []).map((d) => DAY_CODES[d]).filter(Boolean);
    const byDay = days.length ? `;BYDAY=${days.join(",")}` : "";
    return [`RRULE:FREQ=WEEKLY${interval}${byDay}${tail}`];
  }

  if (rule.freq === "monthly") {
    return [`RRULE:FREQ=MONTHLY${interval}${tail}`];
  }

  // Daily, possibly restricted to part of the week.
  //
  // "Every weekday" is expressed in RRULE as a weekly rule with five days on
  // it, not a daily one — there is no daily filter. That makes INTERVAL mean
  // something different (every N *weeks* rather than every N days), so a rule
  // combining an interval with a filter cannot be said exactly; the filter is
  // the part users actually mean, so it wins and the interval is dropped.
  if (rule.daysFilter === "weekdays") return [`RRULE:FREQ=WEEKLY;BYDAY=${WEEKDAYS.join(",")}${tail}`];
  if (rule.daysFilter === "weekends") return [`RRULE:FREQ=WEEKLY;BYDAY=${WEEKEND.join(",")}${tail}`];

  return [`RRULE:FREQ=DAILY${interval}${tail}`];
}
