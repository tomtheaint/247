import { Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient, Chronotype } from "@prisma/client";
import { AuthRequest } from "../types";
import { AppError } from "../middleware/errorHandler";

const prisma = new PrismaClient();

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const preferencesSchema = z.object({
  displayName:     z.string().min(1).max(100).optional(),
  bio:             z.string().max(500).optional(),
  isPublic:        z.boolean().optional(),
  wakeTimeWeekday: z.string().regex(TIME_RE, "Must be HH:MM").optional(),
  sleepTimeWeekday:z.string().regex(TIME_RE, "Must be HH:MM").optional(),
  wakeTimeWeekend: z.string().regex(TIME_RE, "Must be HH:MM").optional(),
  sleepTimeWeekend:z.string().regex(TIME_RE, "Must be HH:MM").optional(),
  chronotype:      z.nativeEnum(Chronotype).optional(),
  showHolidays:    z.boolean().optional(),
  timezone:        z.string().min(1).max(60).optional(),
});

export async function getMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, email: true, username: true, displayName: true,
        bio: true, avatarUrl: true, isPublic: true,
        wakeTimeWeekday: true, sleepTimeWeekday: true,
        wakeTimeWeekend: true, sleepTimeWeekend: true,
        chronotype: true, createdAt: true,
        showHolidays: true, timezone: true,
      },
    });
    if (!user) throw new AppError("User not found", 404);
    res.json(user);
  } catch (err) { next(err); }
}

export async function updatePreferences(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = preferencesSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: body,
      select: {
        id: true, email: true, username: true, displayName: true,
        bio: true, isPublic: true,
        wakeTimeWeekday: true, sleepTimeWeekday: true,
        wakeTimeWeekend: true, sleepTimeWeekend: true,
        chronotype: true,
        showHolidays: true, timezone: true,
      },
    });
    res.json(user);
  } catch (err) { next(err); }
}
