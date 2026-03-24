import { Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../types";
import { AppError } from "../middleware/errorHandler";

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function googleOAuthClient() {
  const { OAuth2Client } = require("google-auth-library");
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:4000/api/integrations/google/callback"
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
    const client = googleOAuthClient();
    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/calendar"],
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

    // Get user email from Google
    const { google } = require("googleapis");
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data } = await oauth2.userinfo.get();

    await prisma.calendarIntegration.upsert({
      where: { userId_provider: { userId, provider: "google" } },
      create: {
        userId,
        provider: "google",
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        email: data.email,
      },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        email: data.email,
      },
    });

    res.redirect(`${process.env.FRONTEND_URL ?? "http://localhost:5173"}/settings?connected=google`);
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
      redirectUri: process.env.MS_REDIRECT_URI ?? "http://localhost:4000/api/integrations/microsoft/callback",
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
      redirectUri: process.env.MS_REDIRECT_URI ?? "http://localhost:4000/api/integrations/microsoft/callback",
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

    res.redirect(`${process.env.FRONTEND_URL ?? "http://localhost:5173"}/settings?connected=microsoft`);
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
