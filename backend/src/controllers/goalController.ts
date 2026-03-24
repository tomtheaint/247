import { Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient, GoalStatus, GoalCategory } from "@prisma/client";
import { AuthRequest, paginate } from "../types";
import { AppError } from "../middleware/errorHandler";

const prisma = new PrismaClient();

const goalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.nativeEnum(GoalCategory).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(10).optional(),
  isPublic: z.boolean().optional(),
  programTrackId: z.string().optional().nullable(),
  targetDate: z.string().datetime().optional(),
});

// Computes total scheduled hours from a goal's events
function computeTotalHours(events: { startTime: Date; endTime: Date }[]): number {
  const ms = events.reduce((sum, e) => sum + (e.endTime.getTime() - e.startTime.getTime()), 0);
  return Math.round((ms / 3600000) * 10) / 10;
}

export async function listGoals(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const status = req.query.status as GoalStatus | undefined;

    const where = { userId: req.user!.id, deletedAt: null, ...(status ? { status } : {}) };
    const [goals, total] = await Promise.all([
      prisma.goal.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { events: true, milestones: true } } },
      }),
      prisma.goal.count({ where }),
    ]);

    const completedCounts = await prisma.event.groupBy({
      by: ["goalId"],
      where: { userId: req.user!.id, isCompleted: true, goalId: { in: goals.map((g) => g.id) } },
      _count: { _all: true },
    });
    const completedByGoal = Object.fromEntries(completedCounts.map((c) => [c.goalId, c._count._all]));
    const result = goals.map((g) => ({ ...g, completedEventsCount: completedByGoal[g.id] ?? 0 }));

    res.json(paginate(result, total, page, limit));
  } catch (err) {
    next(err);
  }
}

export async function getGoal(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const goal = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user!.id, deletedAt: null },
      include: {
        milestones: { orderBy: { dueDate: "asc" } },
        progress: { orderBy: { recordedAt: "desc" }, take: 10 },
        events: { select: { startTime: true, endTime: true } },
        _count: { select: { events: true, milestones: true } },
      },
    });
    if (!goal) throw new AppError("Goal not found", 404);
    const { events, ...rest } = goal;
    const completedEventsCount = await prisma.event.count({ where: { goalId: goal.id, isCompleted: true } });
    res.json({ ...rest, totalHours: computeTotalHours(events), completedEventsCount });
  } catch (err) {
    next(err);
  }
}

export async function createGoal(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = goalSchema.parse(req.body);
    const goal = await prisma.goal.create({
      data: { ...body, userId: req.user!.id },
      include: { _count: { select: { events: true, milestones: true } } },
    });
    res.status(201).json({ ...goal, completedEventsCount: 0 });
  } catch (err) {
    next(err);
  }
}

export async function updateGoal(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.goal.findFirst({ where: { id: req.params.id, userId: req.user!.id, deletedAt: null } });
    if (!existing) throw new AppError("Goal not found", 404);

    const body = goalSchema.partial().extend({ status: z.nativeEnum(GoalStatus).optional() }).parse(req.body);
    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: body,
      include: { _count: { select: { events: true, milestones: true } } },
    });
    const completedEventsCount = await prisma.event.count({ where: { goalId: goal.id, isCompleted: true } });
    res.json({ ...goal, completedEventsCount });
  } catch (err) {
    next(err);
  }
}

export async function deleteGoal(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.goal.findFirst({ where: { id: req.params.id, userId: req.user!.id, deletedAt: null } });
    if (!existing) throw new AppError("Goal not found", 404);

    const deleteEvents = req.query.deleteEvents === "true";
    if (deleteEvents) {
      await prisma.event.deleteMany({ where: { goalId: req.params.id, userId: req.user!.id } });
    }

    // Soft-delete: mark as deleted so reviewers can still see the history
    await prisma.goal.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function addProgress(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.goal.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) throw new AppError("Goal not found", 404);

    const body = z.object({ value: z.number(), note: z.string().optional() }).parse(req.body);
    const progress = await prisma.progress.create({
      data: { ...body, goalId: req.params.id, userId: req.user!.id },
    });
    res.status(201).json(progress);
  } catch (err) {
    next(err);
  }
}

export async function listPublicGoals(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const search = req.query.q as string | undefined;
    const category = req.query.category as GoalCategory | undefined;

    const where = {
      isPublic: true,
      ...(category ? { category } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [goals, total] = await Promise.all([
      prisma.goal.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, username: true, displayName: true } },
          milestones: { orderBy: { dueDate: "asc" } },
          events: { select: { startTime: true, endTime: true } },
          _count: { select: { events: true, milestones: true } },
        },
      }),
      prisma.goal.count({ where }),
    ]);

    const data = goals.map(({ events, ...g }) => ({
      ...g,
      totalHours: computeTotalHours(events),
    }));

    res.json(paginate(data, total, page, limit));
  } catch (err) {
    next(err);
  }
}
