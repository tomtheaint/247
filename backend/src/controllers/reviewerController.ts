import { Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient, GoalCategory, TrackDifficulty } from "@prisma/client";
import { AuthRequest, paginate } from "../types";
import { AppError } from "../middleware/errorHandler";

const prisma = new PrismaClient();

export async function listAllGoals(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const search = req.query.q as string | undefined;
    const includeDeleted = req.query.includeDeleted === "true";

    const where = {
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
      ...(!includeDeleted ? { deletedAt: null } : {}),
    };

    const [goals, total] = await Promise.all([
      prisma.goal.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, title: true, description: true, icon: true, color: true,
          status: true, isPublic: true, createdAt: true, deletedAt: true,
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
      totalHours: Math.round(
        events.reduce((s, e) => s + (e.endTime.getTime() - e.startTime.getTime()), 0) / 360000
      ) / 10,
    }));

    res.json(paginate(data, total, page, limit));
  } catch (err) {
    next(err);
  }
}

export async function deleteGoalAsReviewer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const goal = await prisma.goal.findUnique({ where: { id: req.params.goalId } });
    if (!goal) throw new AppError("Goal not found", 404);
    await prisma.goal.delete({ where: { id: req.params.goalId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function promoteGoalToTrack(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const goal = await prisma.goal.findUnique({
      where: { id: req.params.goalId },
      include: { milestones: { orderBy: { dueDate: "asc" } } },
    });
    if (!goal) throw new AppError("Goal not found", 404);

    const body = z.object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      difficulty: z.nativeEnum(TrackDifficulty).optional(),
      estimatedDays: z.number().int().min(1).optional(),
      tags: z.array(z.string()).optional(),
    }).parse(req.body);

    const steps = goal.milestones.map((m, i) => {
      const dayOffset = m.dueDate ? Math.max(0, Math.round((m.dueDate.getTime() - Date.now()) / 86400000)) : i * 7;
      return {
        title: m.title,
        description: m.description ?? "",
        dayOffset,
        durationMinutes: 60,
        order: i + 1,
      };
    });

    const track = await prisma.track.create({
      data: {
        title: body.title ?? goal.title,
        description: body.description ?? goal.description ?? "",
        category: goal.category,
        difficulty: body.difficulty ?? TrackDifficulty.BEGINNER,
        estimatedDays: body.estimatedDays ?? Math.max(30, steps.length * 7),
        tags: body.tags ?? [],
        isPublic: true,
        goalId: goal.id,
        authorId: req.user!.id,
        steps: { create: steps },
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    res.status(201).json(track);
  } catch (err) {
    next(err);
  }
}
