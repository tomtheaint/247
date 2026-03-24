import { Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../types";
import { AppError } from "../middleware/errorHandler";
import { generateGoalSlots, expandRecurring } from "../utils/recurrence";
import { detectConflicts, conflictsWithSleep, findAlternativeSlot, findBestSlot, findNextAvailableSlot } from "../utils/conflicts";

const prisma = new PrismaClient();

/**
 * Expand recurring event templates into pseudo-instances for conflict detection.
 * Returns both the instances (with fake IDs) and a Map from fakeId → parentEventId
 * so callers can identify which parent template is responsible for each conflict.
 */
function buildRecurInstances(
  recurringEvents: { id: string; startTime: Date; endTime: Date; recurrence: unknown; isLocked?: boolean; goalId?: string | null }[],
  rangeStart: Date,
  rangeEnd: Date,
): {
  instances: { id: string; startTime: Date; endTime: Date; isLocked: boolean; goalId: string | null }[];
  parentMap: Map<string, string>; // pseudoId → parentEventId
} {
  const instances: { id: string; startTime: Date; endTime: Date; isLocked: boolean; goalId: string | null }[] = [];
  const parentMap = new Map<string, string>();
  let idx = 0;
  for (const ev of recurringEvents) {
    const expanded = expandRecurring(
      { id: ev.id, startTime: ev.startTime, endTime: ev.endTime, recurrence: ev.recurrence },
      rangeStart,
      rangeEnd,
    );
    for (const inst of expanded) {
      const pseudoId = `__recur_${idx++}__`;
      parentMap.set(pseudoId, ev.id);
      instances.push({ id: pseudoId, startTime: inst.startTime, endTime: inst.endTime, isLocked: ev.isLocked ?? false, goalId: ev.goalId ?? null });
    }
  }
  return { instances, parentMap };
}

/** Extract the set of recurring parent IDs from a conflict set using the parentMap. */
function conflictedParentIds(conflicted: Set<string>, parentMap: Map<string, string>): string[] {
  const parents = new Set<string>();
  for (const id of conflicted) {
    const parentId = parentMap.get(id);
    if (parentId) parents.add(parentId);
  }
  return Array.from(parents);
}

const scheduleSchema = z.object({
  goalId: z.string(),
  pace: z.enum(["slow", "medium", "fast"]).optional().default("medium"),
  eventLengthMinutes: z.number().int().min(15).max(480),
  days: z.enum(["weekdays", "weekends", "both"]),
  timeOfDay: z.enum(["morning", "afternoon", "evening"]),
  weeks: z.number().int().min(1).max(52),
  tzOffset: z.number().default(0),
  timesPerWeek: z.number().int().min(1).max(14).optional(),
});

export async function scheduleGoalSessions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = scheduleSchema.parse(req.body);

    const goal = await prisma.goal.findFirst({ where: { id: body.goalId, userId: req.user!.id } });
    if (!goal) throw new AppError("Goal not found", 404);

    // Load existing events for the scheduling window to detect conflicts
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + body.weeks * 7 + 30);

    const existingEvents = await prisma.event.findMany({
      where: {
        userId: req.user!.id,
        startTime: { gte: new Date() },
        endTime: { lte: windowEnd },
      },
      select: { startTime: true, endTime: true },
    });

    const userPrefs = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        wakeTimeWeekday: true, sleepTimeWeekday: true,
        wakeTimeWeekend: true, sleepTimeWeekend: true,
        chronotype: true,
      },
    });

    const slots = generateGoalSlots({
      pace: body.pace,
      eventLengthMinutes: body.eventLengthMinutes,
      days: body.days,
      timeOfDay: body.timeOfDay,
      weeks: body.weeks,
      existingEvents,
      userPrefs: userPrefs ?? undefined,
      tzOffsetMinutes: body.tzOffset,
      timesPerWeekOverride: body.timesPerWeek,
    });

    if (slots.length === 0) {
      throw new AppError("No available slots found. Try different preferences.", 422);
    }

    await prisma.event.createMany({
      data: slots.map((s) => ({
        title: goal.title,
        description: `Scheduled ${body.pace} session for goal: ${goal.title}`,
        startTime: s.startTime,
        endTime: s.endTime,
        goalId: goal.id,
        userId: req.user!.id,
        color: goal.color,
      })),
    });

    res.status(201).json({ created: slots.length, message: `Scheduled ${slots.length} sessions.` });
  } catch (err) {
    next(err);
  }
}

// ─── Conflict detection ───────────────────────────────────────────────────────

export async function getConflicts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { start, end, tzOffset } = req.query;
    const rangeStart = start ? new Date(start as string) : new Date();
    const rangeEnd   = end   ? new Date(end   as string) : new Date(Date.now() + 30 * 86400000);
    const tz = tzOffset ? parseInt(tzOffset as string, 10) : 0;

    const [nonRecurring, recurring, prefs] = await Promise.all([
      prisma.event.findMany({
        where: { userId: req.user!.id, isRecurring: false, startTime: { gte: rangeStart, lte: rangeEnd } },
        select: { id: true, title: true, startTime: true, endTime: true, goalId: true, isLocked: true, isRecurring: true, recurrence: true },
      }),
      // Recurring templates may predate the range — fetch all whose template start <= rangeEnd
      prisma.event.findMany({
        where: { userId: req.user!.id, isRecurring: true, startTime: { lte: rangeEnd } },
        select: { id: true, title: true, startTime: true, endTime: true, goalId: true, isLocked: true, isRecurring: true, recurrence: true },
      }),
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          wakeTimeWeekday: true, sleepTimeWeekday: true,
          wakeTimeWeekend: true, sleepTimeWeekend: true,
          chronotype: true,
        },
      }),
    ]);

    if (!prefs) { res.json({ conflictedIds: [], conflictedRecurringParentIds: [], conflictingByParent: {} }); return; }

    const { instances: recurInstances, parentMap } = buildRecurInstances(recurring, rangeStart, rangeEnd);
    const conflicted = detectConflicts([...nonRecurring, ...recurInstances], prefs, tz);

    // Build per-parent detail map: what does each conflicting recurring series clash with?
    // Build a lookup of recurring titles for recurring-vs-recurring conflicts.
    const recurringTitles = new Map(recurring.map((r) => [r.id, r.title]));

    const conflictingByParent: Record<string, Array<{ title: string; startTime: string; endTime: string }>> = {};
    for (const inst of recurInstances) {
      if (!conflicted.has(inst.id)) continue;
      const parentId = parentMap.get(inst.id);
      if (!parentId) continue;
      if (!conflictingByParent[parentId]) conflictingByParent[parentId] = [];

      // 1. Overlapping non-recurring events
      for (const nr of nonRecurring) {
        if (inst.startTime < nr.endTime && inst.endTime > nr.startTime) {
          if (!conflictingByParent[parentId].some((x) => x.title === nr.title)) {
            conflictingByParent[parentId].push({ title: nr.title, startTime: nr.startTime.toISOString(), endTime: nr.endTime.toISOString() });
          }
        }
      }

      // 2. Overlapping instances from OTHER recurring series
      for (const other of recurInstances) {
        if (other.id === inst.id) continue;
        const otherParentId = parentMap.get(other.id);
        if (!otherParentId || otherParentId === parentId) continue;
        if (inst.startTime < other.endTime && inst.endTime > other.startTime) {
          const otherTitle = recurringTitles.get(otherParentId) ?? "another recurring event";
          const label = `Overlaps with "${otherTitle}" (recurring)`;
          if (!conflictingByParent[parentId].some((x) => x.title === label)) {
            conflictingByParent[parentId].push({ title: label, startTime: other.startTime.toISOString(), endTime: other.endTime.toISOString() });
          }
        }
      }

      // 3. Sleep/wake window — only if explicitly true (not as a catch-all fallback)
      if (conflictsWithSleep(inst, prefs, tz)) {
        const sleepLabel = "Outside sleep/wake window";
        if (!conflictingByParent[parentId].some((x) => x.title === sleepLabel)) {
          conflictingByParent[parentId].push({ title: sleepLabel, startTime: inst.startTime.toISOString(), endTime: inst.endTime.toISOString() });
        }
      }
    }

    // Build per-event detail map for non-recurring conflicted events
    const conflictingByEvent: Record<string, Array<{ title: string; startTime: string; endTime: string }>> = {};
    for (const ev of nonRecurring) {
      if (!conflicted.has(ev.id)) continue;
      conflictingByEvent[ev.id] = [];

      // 1. Overlapping non-recurring events
      for (const other of nonRecurring) {
        if (other.id === ev.id) continue;
        if (ev.startTime < other.endTime && ev.endTime > other.startTime) {
          if (!conflictingByEvent[ev.id].some((x) => x.title === other.title)) {
            conflictingByEvent[ev.id].push({ title: other.title, startTime: other.startTime.toISOString(), endTime: other.endTime.toISOString() });
          }
        }
      }

      // 2. Overlapping recurring instances
      for (const inst of recurInstances) {
        if (ev.startTime < inst.endTime && ev.endTime > inst.startTime) {
          const parentId = parentMap.get(inst.id);
          const title = parentId ? (recurringTitles.get(parentId) ?? "recurring event") : "recurring event";
          const label = `Overlaps with "${title}" (recurring)`;
          if (!conflictingByEvent[ev.id].some((x) => x.title === label)) {
            conflictingByEvent[ev.id].push({ title: label, startTime: inst.startTime.toISOString(), endTime: inst.endTime.toISOString() });
          }
        }
      }

      // 3. Sleep/wake window
      if (conflictsWithSleep(ev, prefs, tz)) {
        conflictingByEvent[ev.id].push({ title: "Outside sleep/wake window", startTime: ev.startTime.toISOString(), endTime: ev.endTime.toISOString() });
      }
    }

    // Surface real event IDs for non-recurring events
    const conflictedIds = Array.from(conflicted).filter((id) => !id.startsWith("__recur_"));

    // For recurring events, only flag as conflicted on the calendar when there is an actual
    // EVENT OVERLAP (not just a sleep-window issue). Sleep conflicts for recurring events are
    // often DST-induced false positives because expandRecurring advances by exact 24h UTC
    // intervals, which can shift an hour locally across DST transitions.
    const overlappingRecurParentIds = new Set<string>();
    const conflictedRecurringInstances: Array<{ parentId: string; startTime: string }> = [];
    for (const inst of recurInstances) {
      const parentId = parentMap.get(inst.id);
      if (!parentId) continue;
      const hasOverlap =
        nonRecurring.some((nr) => inst.startTime < nr.endTime && inst.endTime > nr.startTime) ||
        recurInstances.some((other) => other.id !== inst.id && inst.startTime < other.endTime && inst.endTime > other.startTime);
      if (hasOverlap) {
        overlappingRecurParentIds.add(parentId);
        conflictedRecurringInstances.push({ parentId, startTime: inst.startTime.toISOString() });
      }
    }

    res.json({ conflictedIds, conflictedRecurringParentIds: Array.from(overlappingRecurParentIds), conflictedRecurringInstances, conflictingByParent, conflictingByEvent });
  } catch (err) { next(err); }
}

// ─── Auto-resolve conflicts ───────────────────────────────────────────────────

export async function resolveConflicts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { start, end, tzOffset } = z.object({
      start:    z.string().optional(),
      end:      z.string().optional(),
      tzOffset: z.number().default(0),
    }).parse(req.body);
    const tz = tzOffset;

    const rangeStart = start ? new Date(start) : new Date();
    const rangeEnd   = end   ? new Date(end)   : new Date(Date.now() + 30 * 86400000);

    const [nonRecurring, recurring, prefs] = await Promise.all([
      prisma.event.findMany({
        where: { userId: req.user!.id, isRecurring: false, startTime: { gte: rangeStart, lte: rangeEnd } },
        select: { id: true, startTime: true, endTime: true, goalId: true, isLocked: true, isRecurring: true, recurrence: true, priority: true },
      }),
      prisma.event.findMany({
        where: { userId: req.user!.id, isRecurring: true, startTime: { lte: rangeEnd } },
        select: { id: true, startTime: true, endTime: true, goalId: true, isLocked: true, isRecurring: true, recurrence: true },
      }),
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          wakeTimeWeekday: true, sleepTimeWeekday: true,
          wakeTimeWeekend: true, sleepTimeWeekend: true,
          chronotype: true,
        },
      }),
    ]);

    if (!prefs) { res.json({ resolved: 0, unresolvable: [], unresolvableRecurring: [] }); return; }
    const { instances: recurInstances, parentMap } = buildRecurInstances(recurring, rangeStart, rangeEnd);

    const conflictedSet = detectConflicts([...nonRecurring, ...recurInstances], prefs, tz);

    // Only try to move goal-linked, non-locked, non-recurring events
    const toResolve = nonRecurring.filter((e) => conflictedSet.has(e.id) && e.goalId !== null && !e.isLocked && e.priority !== "HIGH");

    const resolved: string[] = [];
    const unresolvable: string[] = [];

    // Include recurring instances as immovable walls
    let liveEvents = [...nonRecurring, ...recurInstances];

    for (const ev of toResolve) {
      const durationMs = ev.endTime.getTime() - ev.startTime.getTime();
      const slot = findAlternativeSlot(ev, durationMs, liveEvents, prefs, tz);

      if (slot) {
        await prisma.event.update({
          where: { id: ev.id },
          data: { startTime: slot.startTime, endTime: slot.endTime },
        });
        liveEvents = liveEvents.map((e) =>
          e.id === ev.id ? { ...e, startTime: slot.startTime, endTime: slot.endTime } : e
        );
        resolved.push(ev.id);
      } else {
        unresolvable.push(ev.id);
      }
    }

    // Detect any remaining conflicts involving recurring instances (can't be auto-resolved)
    const remaining = detectConflicts(liveEvents, prefs, tz);
    res.json({ resolved: resolved.length, unresolvable, unresolvableRecurring: conflictedParentIds(remaining, parentMap) });
  } catch (err) { next(err); }
}

// ─── Smart schedule optimizer ─────────────────────────────────────────────────

export async function optimizeSchedule(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { start, end, tzOffset } = z.object({
      start:    z.string(),
      end:      z.string(),
      tzOffset: z.number().default(0),
    }).parse(req.body);

    const rangeStart = new Date(start);
    const rangeEnd   = new Date(end);

    const [nonRecurring, recurring, prefs] = await Promise.all([
      prisma.event.findMany({
        where: { userId: req.user!.id, isRecurring: false, startTime: { gte: rangeStart, lte: rangeEnd } },
        select: { id: true, startTime: true, endTime: true, goalId: true, isLocked: true, isRecurring: true, recurrence: true, priority: true },
      }),
      prisma.event.findMany({
        where: { userId: req.user!.id, isRecurring: true, startTime: { lte: rangeEnd } },
        select: { id: true, startTime: true, endTime: true, goalId: true, isLocked: true, isRecurring: true, recurrence: true },
      }),
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          wakeTimeWeekday: true, sleepTimeWeekday: true,
          wakeTimeWeekend: true, sleepTimeWeekend: true,
          chronotype: true,
        },
      }),
    ]);
    const { instances: recurInstances, parentMap } = buildRecurInstances(recurring, rangeStart, rangeEnd);

    if (!prefs) {
      res.json({ optimized: 0, unplaceable: [], unresolvableRecurring: [] });
      return;
    }
    if (nonRecurring.length === 0) {
      // Still detect recurring-vs-locked conflicts even if there's nothing movable
      const onlyWalls = [...recurInstances];
      const wallConflicts = detectConflicts(onlyWalls, prefs, tzOffset);
      res.json({ optimized: 0, unplaceable: [], unresolvableRecurring: conflictedParentIds(wallConflicts, parentMap) });
      return;
    }

    // Locked events + HIGH priority + recurring instances are immovable walls everything fits around
    const locked   = nonRecurring.filter((e) => e.isLocked || e.priority === "HIGH");
    const movable  = nonRecurring.filter((e) => !e.isLocked && e.priority !== "HIGH")
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const placed: Array<{ id: string; startTime: Date; endTime: Date }> = [];
    const unplaceable: string[] = [];

    for (const ev of movable) {
      const durationMs = ev.endTime.getTime() - ev.startTime.getTime();
      const occupied   = [...locked, ...recurInstances, ...placed];
      const slot = findBestSlot(ev, durationMs, occupied, prefs, rangeStart, rangeEnd, tzOffset);

      if (slot) {
        placed.push({ id: ev.id, startTime: slot.startTime, endTime: slot.endTime });
      } else {
        // Cannot place — keep original position so it doesn't disappear
        placed.push({ id: ev.id, startTime: ev.startTime, endTime: ev.endTime });
        unplaceable.push(ev.id);
      }
    }

    // Only write events that actually changed position
    const toUpdate = placed.filter((p) => {
      const orig = movable.find((e) => e.id === p.id)!;
      return p.startTime.getTime() !== orig.startTime.getTime();
    });

    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map((p) =>
          prisma.event.update({
            where: { id: p.id },
            data: { startTime: p.startTime, endTime: p.endTime },
          })
        )
      );
    }

    // Detect any remaining recurring-vs-anything conflicts after optimization
    const finalOccupied = [...placed.map((p) => ({ ...p, id: p.id, goalId: null, isLocked: false })), ...locked.map((e) => ({ ...e, goalId: e.goalId ?? null })), ...recurInstances];
    const finalConflicts = detectConflicts(finalOccupied, prefs, tzOffset);

    res.json({ optimized: toUpdate.length, unplaceable, unresolvableRecurring: conflictedParentIds(finalConflicts, parentMap) });
  } catch (err) { next(err); }
}

// ─── Snooze: move one event to the next available slot tomorrow+ ──────────────

export async function snoozeEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { tzOffset, dryRun } = z.object({ tzOffset: z.number().default(0), dryRun: z.boolean().default(false) }).parse(req.body);

    const ev = await prisma.event.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!ev) throw new AppError("Event not found", 404);
    if (ev.isLocked) throw new AppError("Cannot snooze a locked event", 400);

    const [futureEvents, prefs] = await Promise.all([
      prisma.event.findMany({
        where: { userId: req.user!.id, isRecurring: false, id: { not: ev.id }, startTime: { gt: ev.startTime } },
        select: { startTime: true, endTime: true },
      }),
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { wakeTimeWeekday: true, sleepTimeWeekday: true, wakeTimeWeekend: true, sleepTimeWeekend: true, chronotype: true },
      }),
    ]);

    if (!prefs) throw new AppError("User preferences not found", 404);

    const durationMs = ev.endTime.getTime() - ev.startTime.getTime();
    const slot = findNextAvailableSlot(ev, durationMs, futureEvents, prefs, tzOffset);

    if (dryRun) {
      res.json({
        current: { startTime: ev.startTime.toISOString(), endTime: ev.endTime.toISOString() },
        proposed: slot ? { startTime: slot.startTime.toISOString(), endTime: slot.endTime.toISOString() } : null,
      });
      return;
    }
    if (!slot) throw new AppError("No available slot found in the next 14 days", 422);

    const updated = await prisma.event.update({
      where: { id: ev.id },
      data: { startTime: slot.startTime, endTime: slot.endTime },
      include: { goal: { select: { id: true, title: true, color: true, icon: true } } },
    });
    res.json(updated);
  } catch (err) { next(err); }
}

// ─── Take the day off: push all non-locked events for a day to later ──────────

export async function takeDayOff(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { date, tzOffset } = z.object({ date: z.string(), tzOffset: z.number().default(0) }).parse(req.body);

    const dayStart = new Date(date);                                   // local midnight (from frontend)
    const dayEnd   = new Date(dayStart.getTime() + 86400000);

    const [dayEvents, futureEvents, prefs] = await Promise.all([
      prisma.event.findMany({
        where: { userId: req.user!.id, isRecurring: false, isLocked: false, startTime: { gte: dayStart, lt: dayEnd } },
        select: { id: true, startTime: true, endTime: true, goalId: true },
      }),
      prisma.event.findMany({
        where: { userId: req.user!.id, isRecurring: false, startTime: { gte: dayEnd } },
        select: { startTime: true, endTime: true },
      }),
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { wakeTimeWeekday: true, sleepTimeWeekday: true, wakeTimeWeekend: true, sleepTimeWeekend: true, chronotype: true },
      }),
    ]);

    if (!prefs) throw new AppError("User preferences not found", 404);

    const rescheduled: string[] = [];
    const unschedulable: string[] = [];
    let occupied: { startTime: Date; endTime: Date }[] = [...futureEvents];

    for (const ev of dayEvents) {
      const durationMs = ev.endTime.getTime() - ev.startTime.getTime();
      const slot = findNextAvailableSlot(ev, durationMs, occupied, prefs, tzOffset);
      if (slot) {
        await prisma.event.update({ where: { id: ev.id }, data: { startTime: slot.startTime, endTime: slot.endTime } });
        occupied = [...occupied, { startTime: slot.startTime, endTime: slot.endTime }];
        rescheduled.push(ev.id);
      } else {
        unschedulable.push(ev.id);
      }
    }

    res.json({ rescheduled: rescheduled.length, unschedulable, total: dayEvents.length });
  } catch (err) { next(err); }
}
