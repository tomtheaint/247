import { Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../types";
import { AppError } from "../middleware/errorHandler";

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Where the provider sends the browser back to.
 *
 * This defaulted to http://localhost:4000/... and the deployed app went on
 * sending that to Google, which answers `Error 400: redirect_uri_mismatch` and
 * names a URI that appears nowhere in your configuration — so the thing to fix
 * is invisible from both ends.
 *
 * PUBLIC_URL is the origin this API answers on. The combined image serves the
 * API and the frontend from one origin, so it is the site's own address. An
 * explicit GOOGLE_REDIRECT_URI / MS_REDIRECT_URI still wins, since the value
 * has to match what is registered with the provider character for character and
 * sometimes that is not the tidy one.
 */
function callbackUrl(provider: "google" | "microsoft"): string {
  const explicit =
    provider === "google" ? process.env.GOOGLE_REDIRECT_URI : process.env.MS_REDIRECT_URI;
  if (explicit) return explicit;
  const base = (process.env.PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
  if (base) return `${base}/api/integrations/${provider}/callback`;
  return `http://localhost:4000/api/integrations/${provider}/callback`;
}

/**
 * Where to send the browser once the provider has sent it back to us.
 *
 * Same failure as the callback URL, one step later: this fell back to the Vite
 * dev server, so a connection that had just succeeded ended at
 * localhost:5173 — which looks, from the outside, exactly like the connection
 * failing. FRONTEND_URL first, since a split deployment has one; PUBLIC_URL
 * otherwise, because the combined image serves the app from its own origin.
 */
function settingsOrigin(): string {
  for (const candidate of [process.env.FRONTEND_URL, process.env.PUBLIC_URL]) {
    const base = (candidate ?? "").trim().replace(/\/+$/, "");
    if (isAbsoluteHttpUrl(base)) return base;
    if (base) {
      // `FRONTEND_URL=*` is the reason this check exists. It is a reasonable
      // thing to write for a CORS origin and a meaningless thing to redirect
      // to: the browser resolved it against the callback path and landed on
      // /api/integrations/google/*/settings, which is an authenticated route,
      // so a completed connection ended at "No token provided".
      console.warn(
        `Ignoring ${base === process.env.FRONTEND_URL?.trim() ? "FRONTEND_URL" : "PUBLIC_URL"}=` +
          `"${base}" for the post-connection redirect: it is not an absolute http(s) URL.`,
      );
    }
  }
  return "http://localhost:5173";
}

/** A redirect target has to be somewhere a browser can go, not a wildcard. */
function isAbsoluteHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function googleOAuthClient() {
  const { OAuth2Client } = require("google-auth-library");
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl("google")
  );
}

function msalApp() {
  const msal = require("@azure/msal-node");
  return new msal.ConfidentialClientApplication({
    auth: {
      clientId: process.env.MS_CLIENT_ID ?? "",
      clientSecret: process.env.MS_CLIENT_SECRET ?? "",
      authority: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID ?? "common"}`,
    },
  });
}

// ─── List integrations ────────────────────────────────────────────────────────

export async function listIntegrations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const integrations = await prisma.calendarIntegration.findMany({
      where: { userId: req.user!.id },
      select: { provider: true, email: true, createdAt: true },
    });
    res.json(integrations);
  } catch (err) { next(err); }
}

// ─── Google ───────────────────────────────────────────────────────────────────

export async function googleAuthUrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) throw new AppError("Google integration not configured", 501);
    // The one fact needed to fix a redirect_uri_mismatch, which is otherwise
    // only visible in Google's error page and only to whoever hit it.
    const redirect = callbackUrl("google");
    if (redirect.startsWith("http://localhost") && process.env.NODE_ENV === "production") {
      console.warn(
        `Google OAuth is sending redirect_uri=${redirect} from a production ` +
          `deployment, which cannot work. Set PUBLIC_URL to this site's address.`,
      );
    }
    const client = googleOAuthClient();
    const url = client.generateAuthUrl({
      access_type: "offline",
      // The callback asks Google who just authorised, and that is a separate
      // permission from reading their calendar. Requesting only `calendar` got
      // a token that `oauth2.userinfo.get()` is not allowed to use, so consent
      // succeeded and the callback then failed with a 500 — the worst place for
      // it, since by then the user has already clicked Allow.
      scope: [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/calendar",
      ],
      state: req.user!.id,
      prompt: "consent",
    });
    res.json({ url });
  } catch (err) { next(err); }
}

export async function googleCallback(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { code, state: userId } = req.query as { code: string; state: string };
    if (!userId) throw new AppError("Invalid state", 400);

    const client = googleOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Which account this is, for the label on the settings page.
    //
    // Not worth failing the connection over. `email` is optional in the schema,
    // the tokens are the part that does the work, and throwing here discards a
    // consent the user has already granted — they would have to go round the
    // whole flow again to fix a missing caption.
    let email: string | undefined;
    try {
      const { google } = require("googleapis");
      const oauth2 = google.oauth2({ version: "v2", auth: client });
      const { data } = await oauth2.userinfo.get();
      email = data.email ?? undefined;
    } catch (err) {
      console.warn(
        "Connected Google Calendar but could not read the account address:",
        err instanceof Error ? err.message : err,
      );
    }

    await prisma.calendarIntegration.upsert({
      where: { userId_provider: { userId, provider: "google" } },
      create: {
        userId,
        provider: "google",
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        email,
      },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        email,
      },
    });

    res.redirect(`${settingsOrigin()}/settings?connected=google`);
  } catch (err) { next(err); }
}

export async function googleSync(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const integration = await prisma.calendarIntegration.findUnique({
      where: { userId_provider: { userId: req.user!.id, provider: "google" } },
    });
    if (!integration) throw new AppError("Google Calendar not connected", 404);

    const client = googleOAuthClient();
    client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
    });

    const { google } = require("googleapis");
    const calendar = google.calendar({ version: "v3", auth: client });

    // Fetch events from Google for the next 30 days
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const { data } = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: in30.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });

    const gEvents = (data.items ?? []) as Array<{
      id: string; summary?: string; description?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;

    let imported = 0;
    for (const ge of gEvents) {
      if (!ge.start?.dateTime && !ge.start?.date) continue;
      const startTime = new Date(ge.start.dateTime ?? ge.start.date!);
      const endTime = new Date((ge.end?.dateTime ?? ge.end?.date) ? (ge.end!.dateTime ?? ge.end!.date!) : startTime.getTime() + 3600000);

      await prisma.event.upsert({
        where: { id: `google_${ge.id}` },
        create: {
          id: `google_${ge.id}`,
          title: ge.summary ?? "(No title)",
          description: ge.description,
          startTime,
          endTime,
          allDay: !ge.start.dateTime,
          userId: req.user!.id,
          color: "#34a853",
        },
        update: { title: ge.summary ?? "(No title)", startTime, endTime },
      });
      imported++;
    }

    res.json({ synced: imported });
  } catch (err) { next(err); }
}

export async function disconnectIntegration(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { provider } = req.params as { provider: string };
    await prisma.calendarIntegration.deleteMany({
      where: { userId: req.user!.id, provider },
    });
    res.status(204).send();
  } catch (err) { next(err); }
}

// ─── Microsoft 365 ───────────────────────────────────────────────────────────

export async function microsoftAuthUrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!process.env.MS_CLIENT_ID) throw new AppError("Microsoft integration not configured", 501);
    const app = msalApp();
    const result = await app.getAuthCodeUrl({
      scopes: ["Calendars.ReadWrite", "User.Read", "offline_access"],
      redirectUri: callbackUrl("microsoft"),
      state: req.user!.id,
    });
    res.json({ url: result });
  } catch (err) { next(err); }
}

export async function microsoftCallback(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { code, state: userId } = req.query as { code: string; state: string };
    const app = msalApp();
    const result = await app.acquireTokenByCode({
      code,
      scopes: ["Calendars.ReadWrite", "User.Read", "offline_access"],
      redirectUri: callbackUrl("microsoft"),
    });

    const Client = require("@microsoft/microsoft-graph-client").Client;
    const graphClient = Client.initWithMiddleware({
      authProvider: { getAccessToken: async () => result.accessToken },
    });
    const me = await graphClient.api("/me").get();

    await prisma.calendarIntegration.upsert({
      where: { userId_provider: { userId, provider: "microsoft" } },
      create: {
        userId,
        provider: "microsoft",
        accessToken: result.accessToken,
        refreshToken: result.account?.homeAccountId,
        expiresAt: result.expiresOn ?? undefined,
        email: me.userPrincipalName,
      },
      update: {
        accessToken: result.accessToken,
        expiresAt: result.expiresOn ?? undefined,
        email: me.userPrincipalName,
      },
    });

    res.redirect(`${settingsOrigin()}/settings?connected=microsoft`);
  } catch (err) { next(err); }
}

export async function microsoftSync(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const integration = await prisma.calendarIntegration.findUnique({
      where: { userId_provider: { userId: req.user!.id, provider: "microsoft" } },
    });
    if (!integration) throw new AppError("Microsoft Calendar not connected", 404);

    const Client = require("@microsoft/microsoft-graph-client").Client;
    const graphClient = Client.initWithMiddleware({
      authProvider: { getAccessToken: async () => integration.accessToken },
    });

    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const events = await graphClient
      .api("/me/calendarView")
      .query({ startDateTime: now.toISOString(), endDateTime: in30.toISOString(), $top: 100 })
      .get();

    let imported = 0;
    for (const ev of events.value ?? []) {
      const startTime = new Date(ev.start?.dateTime ?? ev.start?.date);
      const endTime = new Date(ev.end?.dateTime ?? ev.end?.date ?? startTime.getTime() + 3600000);
      await prisma.event.upsert({
        where: { id: `ms_${ev.id}` },
        create: {
          id: `ms_${ev.id}`,
          title: ev.subject ?? "(No title)",
          description: ev.bodyPreview,
          startTime,
          endTime,
          allDay: ev.isAllDay ?? false,
          userId: req.user!.id,
          color: "#0078d4",
        },
        update: { title: ev.subject ?? "(No title)", startTime, endTime },
      });
      imported++;
    }

    res.json({ synced: imported });
  } catch (err) { next(err); }
}
