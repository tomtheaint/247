import { Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../types";
import { AppError } from "../middleware/errorHandler";
import { expandRecurring } from "../utils/recurrence";

const prisma = new PrismaClient();

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  allDay: z.boolean().optional(),
  color: z.string().optional(),
  isLocked: z.boolean().optional(),
  isCompleted: z.boolean().optional(),
  goalId: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurrence: z.record(z.unknown()).nullable().optional(),
  priority: z.enum(["HIGH", "NORMAL", "LOW"]).optional(),
});

export async function listRecurringEvents(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const events = await prisma.event.findMany({
      where: { userId: req.user!.id, isRecurring: true },
      orderBy: { startTime: "asc" },
      include: { goal: { select: { id: true, title: true, color: true, icon: true } } },
    });
    res.json(events);
  } catch (err) {
    next(err);
  }
}

export async function listEvents(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { start, end } = req.query;
    const rangeStart = start ? new Date(start as string) : new Date(0);
    const rangeEnd = end ? new Date(end as string) : new Date(Date.now() + 365 * 86400000);

    // Fetch non-recurring events in range
    const regular = await prisma.event.findMany({
      where: {
        userId: req.user!.id,
        isRecurring: false,
        startTime: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: { startTime: "asc" },
      include: { goal: { select: { id: true, title: true, color: true, icon: true } } },
    });

    // Fetch recurring parent events whose start is before rangeEnd
    const recurring = await prisma.event.findMany({
      where: {
        userId: req.user!.id,
        isRecurring: true,
        startTime: { lte: rangeEnd },
      },
      include: { goal: { select: { id: true, title: true, color: true, icon: true } } },
    });

    // Expand recurring events into instances within the range
    const expanded = recurring.flatMap((ev) => {
      const instances = expandRecurring(
        { ...ev, startTime: ev.startTime, endTime: ev.endTime },
        rangeStart,
        rangeEnd
      );
      return instances.map((inst, i) => ({
        ...ev,
        id: `${ev.id}_${i}`,
        startTime: inst.startTime,
        endTime: inst.endTime,
        recurringParentId: ev.id,
      }));
    });

    const all = [...regular, ...expanded].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    res.json(all);
  } catch (err) {
    next(err);
  }
}

export async function getEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const event = await prisma.event.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { goal: true },
    });
    if (!event) throw new AppError("Event not found", 404);
    res.json(event);
  } catch (err) {
    next(err);
  }
}

export async function createEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = eventSchema.parse(req.body);
    if (new Date(body.endTime) <= new Date(body.startTime)) {
      throw new AppError("endTime must be after startTime", 400);
    }
    const event = await prisma.event.create({
      data: { ...body, userId: req.user!.id },
      include: { goal: { select: { id: true, title: true, color: true, icon: true } } },
    });
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
}

export async function updateEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.event.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) throw new AppError("Event not found", 404);

    // Support deltaMs: shift startTime/endTime by a millisecond offset without needing absolute times
    const { deltaMs, ...rest } = z.object({ deltaMs: z.number().optional() }).passthrough().parse(req.body);
    const body = eventSchema.partial().parse(rest);

    const data: Record<string, unknown> = { ...body };
    if (deltaMs !== undefined) {
      data.startTime = new Date(existing.startTime.getTime() + deltaMs);
      data.endTime = new Date(existing.endTime.getTime() + deltaMs);
    }

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data,
      include: { goal: { select: { id: true, title: true, color: true, icon: true } } },
    });
    res.json(event);
  } catch (err) {
    next(err);
  }
}

export async function detachInstance(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { originalStart, newStart, newEnd } = z.object({
      originalStart: z.string().datetime(),
      newStart: z.string().datetime(),
      newEnd: z.string().datetime(),
    }).parse(req.body);

    const parent = await prisma.event.findFirst({ where: { id: req.params.id, userId: req.user!.id, isRecurring: true } });
    if (!parent) throw new AppError("Recurring event not found", 404);

    // Exclude the original occurrence date from future expansions
    const excludeDate = new Date(originalStart).toISOString().slice(0, 10);
    const existingRule = (parent.recurrence ?? {}) as Record<string, unknown>;
    const existingExcludes = (existingRule.excludeDates as string[] | undefined) ?? [];
    const updatedRule = { ...existingRule, excludeDates: [...new Set([...existingExcludes, excludeDate])] };

    // Create detached one-off event + update parent recurrence in parallel
    const [newEvent] = await Promise.all([
      prisma.event.create({
        data: {
          title: parent.title,
          description: parent.description ?? undefined,
          startTime: new Date(newStart),
          endTime: new Date(newEnd),
          allDay: parent.allDay,
          color: parent.color ?? undefined,
          isLocked: parent.isLocked,
          goalId: parent.goalId ?? undefined,
          userId: req.user!.id,
          isRecurring: false,
          priority: parent.priority,
          recurrence: null,
        },
        include: { goal: { select: { id: true, title: true, color: true, icon: true } } },
      }),
      prisma.event.update({
        where: { id: parent.id },
        data: { recurrence: updatedRule },
      }),
    ]);

    res.status(201).json(newEvent);
  } catch (err) {
    next(err);
  }
}

export async function deleteEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.event.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) throw new AppError("Event not found", 404);
    await prisma.event.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function deleteAllEvents(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { count } = await prisma.event.deleteMany({ where: { userId: req.user!.id } });
    res.json({ deleted: count });
  } catch (err) {
    next(err);
  }
}
