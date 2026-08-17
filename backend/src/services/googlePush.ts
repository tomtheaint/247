/**
 * Mirroring 247's own events onto a connected Google calendar.
 *
 * One direction. Events created here are the source of truth and Google holds a
 * copy, which is what makes this small: there is no merge, no "who edited last",
 * and no reading an RRULE back. Edit the copy in Google and the next push here
 * overwrites it — a rule that fits in a sentence, which matters more than a
 * cleverer one nobody can predict the outcome of.
 *
 * Never fatal. A save in 247 must not fail because Google was slow, rate-limited
 * or briefly unreachable; every entry point here reports what happened and lets
 * the caller carry on. The alternative is an app that stops working when a
 * third party does.
 */
import { PrismaClient } from "@prisma/client";
import { toGoogleRecurrence } from "../utils/rrule";
import type { RecurrenceRule } from "../utils/recurrence";

const prisma = new PrismaClient();

export type PushOutcome =
  | { status: "pushed"; googleEventId: string }
  | { status: "removed" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

interface PushableEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  isRecurring: boolean;
  recurrence: unknown;
  syncToGoogle: boolean;
  googleEventId: string | null;
}

/** An authenticated calendar client, or null when this user has not connected one. */
async function calendarFor(userId: string) {
  const integration = await prisma.calendarIntegration.findUnique({
    where: { userId_provider: { userId, provider: "google" } },
  });
  if (!integration) return null;

  const { OAuth2Client } = require("google-auth-library");
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
  });
  const { google } = require("googleapis");
  return google.calendar({ version: "v3", auth: client });
}

/**
 * An all-day event is a date, not an instant.
 *
 * Google distinguishes the two by which field is present, and sending a
 * timestamp for an all-day event produces the same 7pm-to-7pm smear that
 * reading one as a timestamp did on the way in.
 */
function asGoogleTimes(event: PushableEvent) {
  if (!event.allDay) {
    return {
      start: { dateTime: event.startTime.toISOString() },
      end: { dateTime: event.endTime.toISOString() },
    };
  }
  const day = (d: Date) => d.toISOString().slice(0, 10);
  return { start: { date: day(event.startTime) }, end: { date: day(event.endTime) } };
}

export function asGoogleEvent(event: PushableEvent) {
  return {
    summary: event.title,
    description: event.description ?? undefined,
    ...asGoogleTimes(event),
    ...(event.isRecurring
      ? { recurrence: toGoogleRecurrence(event.recurrence as RecurrenceRule | null) }
      : {}),
    // So a human looking at their Google calendar can tell where it came from,
    // and so support questions about a mystery entry have an answer.
    source: { title: "247", url: process.env.PUBLIC_URL || "https://247" },
  };
}

/**
 * Bring Google into line with one event.
 *
 * Handles all four transitions rather than only the happy one: newly ticked,
 * already mirrored, newly unticked, and never involved. Unticking deletes the
 * copy — leaving an orphan behind would mean the calendar quietly disagrees with
 * the toggle that claims to control it.
 */
export async function syncEventToGoogle(userId: string, event: PushableEvent): Promise<PushOutcome> {
  // Never push something that came from Google in the first place.
  if (event.id.startsWith("google_") || event.id.startsWith("ms_")) {
    return { status: "skipped", reason: "imported" };
  }
  if (!event.syncToGoogle && !event.googleEventId) return { status: "skipped", reason: "not enabled" };

  const calendar = await calendarFor(userId);
  if (!calendar) {
    return { status: "skipped", reason: "Google Calendar is not connected" };
  }

  try {
    // Turned off: withdraw the copy.
    if (!event.syncToGoogle && event.googleEventId) {
      await calendar.events.delete({ calendarId: "primary", eventId: event.googleEventId })
        .catch((err: { code?: number }) => {
          // Already gone is the state we wanted anyway.
          if (err?.code !== 404 && err?.code !== 410) throw err;
        });
      await prisma.event.update({ where: { id: event.id }, data: { googleEventId: null } });
      return { status: "removed" };
    }

    const body = asGoogleEvent(event);

    if (event.googleEventId) {
      try {
        await calendar.events.update({
          calendarId: "primary", eventId: event.googleEventId, requestBody: body,
        });
        return { status: "pushed", googleEventId: event.googleEventId };
      } catch (err) {
        // Deleted on the Google side. Recreating is the behaviour the toggle
        // promises; treating it as an error would leave the event permanently
        // un-mirrored with the switch still on.
        const code = (err as { code?: number })?.code;
        if (code !== 404 && code !== 410) throw err;
      }
    }

    const { data } = await calendar.events.insert({ calendarId: "primary", requestBody: body });
    await prisma.event.update({ where: { id: event.id }, data: { googleEventId: data.id } });
    return { status: "pushed", googleEventId: data.id };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`Could not mirror event ${event.id} to Google:`, reason);
    return { status: "failed", reason };
  }
}

/**
 * Remove the Google copy of an event that is being deleted here.
 *
 * Called before the local row goes, because afterwards there is nothing left to
 * say which Google event it was.
 */
export async function removeEventFromGoogle(userId: string, googleEventId: string | null): Promise<void> {
  if (!googleEventId) return;
  try {
    const calendar = await calendarFor(userId);
    if (!calendar) return;
    await calendar.events.delete({ calendarId: "primary", eventId: googleEventId })
      .catch((err: { code?: number }) => {
        if (err?.code !== 404 && err?.code !== 410) throw err;
      });
  } catch (err) {
    console.warn("Could not remove a mirrored event from Google:", err instanceof Error ? err.message : err);
  }
}
