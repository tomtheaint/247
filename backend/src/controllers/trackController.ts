import { Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient, GoalCategory, TrackDifficulty, ReactionType, Prisma } from "@prisma/client";
import { AuthRequest, paginate } from "../types";
import { AppError } from "../middleware/errorHandler";
import { addDays, startOfDay } from "../utils/dates";

const prisma = new PrismaClient();

const stepSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  dayOffset: z.number().int().min(0),
  durationMinutes: z.number().int().min(1).optional(),
  resources: z.record(z.unknown()).optional(),
  order: z.number().int().min(1),
});

const trackSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string(),
  category: z.nativeEnum(GoalCategory).optional(),
  difficulty: z.nativeEnum(TrackDifficulty).optional(),
  estimatedDays: z.number().int().min(1).optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  steps: z.array(stepSchema).optional(),
});

export async function listPublicTracks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const category = req.query.category as GoalCategory | undefined;
    const difficulty = req.query.difficulty as TrackDifficulty | undefined;
    const search = req.query.q as string | undefined;

    const where = {
      isPublic: true,
      ...(category ? { category } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [tracks, total] = await Promise.all([
      prisma.track.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { adoptionCount: "desc" },
        include: {
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          goals: { select: { id: true, title: true, icon: true, color: true, status: true, _count: { select: { milestones: true } } } },
          _count: { select: { steps: true, userTracks: true, goals: true } },
        },
      }),
      prisma.track.count({ where }),
    ]);

    res.json(paginate(tracks, total, page, limit));
  } catch (err) {
    next(err);
  }
}

export async function getTrack(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const track = await prisma.track.findFirst({
      where: { id: req.params.id, OR: [{ isPublic: true }, { authorId: req.user!.id }] },
      include: {
        steps: { orderBy: { order: "asc" } },
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        reviews: { include: { author: { select: { id: true, username: true } } }, take: 10 },
      },
    });
    if (!track) throw new AppError("Track not found", 404);
    res.json(track);
  } catch (err) {
    next(err);
  }
}

export async function createTrack(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { steps, ...rest } = trackSchema.parse(req.body);
    const track = await prisma.track.create({
      data: {
        ...rest,
        authorId: req.user!.id,
        steps: steps ? { create: steps.map(s => ({ ...s, resources: (s.resources ?? undefined) as Prisma.InputJsonValue | undefined })) } : undefined,
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    res.status(201).json(track);
  } catch (err) {
    next(err);
  }
}

export async function updateTrack(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.track.findFirst({ where: { id: req.params.id, authorId: req.user!.id } });
    if (!existing) throw new AppError("Track not found", 404);

    const { steps, ...rest } = trackSchema.partial().parse(req.body);
    const track = await prisma.track.update({
      where: { id: req.params.id },
      data: rest,
      include: { steps: { orderBy: { order: "asc" } } },
    });
    res.json(track);
  } catch (err) {
    next(err);
  }
}

export async function deleteTrack(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.track.findFirst({ where: { id: req.params.id, authorId: req.user!.id } });
    if (!existing) throw new AppError("Track not found", 404);
    await prisma.track.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function adoptTrack(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const track = await prisma.track.findFirst({
      where: { id: req.params.id, isPublic: true },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (!track) throw new AppError("Track not found", 404);

    const existing = await prisma.userTrack.findUnique({
      where: { userId_trackId: { userId: req.user!.id, trackId: track.id } },
    });
    if (existing?.isActive) throw new AppError("Track already adopted", 409);

    const startDate = new Date();

    const userTrack = await prisma.$transaction(async (tx) => {
      const ut = await tx.userTrack.upsert({
        where: { userId_trackId: { userId: req.user!.id, trackId: track.id } },
        create: { userId: req.user!.id, trackId: track.id, startDate, isActive: true },
        update: { startDate, isActive: true, completedAt: null },
      });

      const events = track.steps.map((step) => ({
        title: step.title,
        description: step.description,
        startTime: addDays(startDate, step.dayOffset),
        endTime: new Date(addDays(startDate, step.dayOffset).getTime() + step.durationMinutes * 60000),
        userId: req.user!.id,
        trackStepId: step.id,
      }));

      await tx.event.createMany({ data: events });
      await tx.track.update({
        where: { id: track.id },
        data: { adoptionCount: { increment: 1 } },
      });

      return ut;
    });

    res.status(201).json(userTrack);
  } catch (err) {
    next(err);
  }
}

export async function reviewTrack(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = z.object({ rating: z.number().int().min(1).max(5), body: z.string().optional() }).parse(req.body);
    const track = await prisma.track.findFirst({ where: { id: req.params.id, isPublic: true } });
    if (!track) throw new AppError("Track not found", 404);

    const review = await prisma.review.upsert({
      where: { trackId_authorId: { trackId: req.params.id, authorId: req.user!.id } },
      create: { trackId: req.params.id, authorId: req.user!.id, ...body },
      update: body,
    });

    const agg = await prisma.review.aggregate({ where: { trackId: req.params.id }, _avg: { rating: true }, _count: true });
    await prisma.track.update({
      where: { id: req.params.id },
      data: { rating: agg._avg.rating ?? 0, ratingCount: agg._count },
    });

    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
}

export async function myTracks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const tracks = await prisma.track.findMany({
      where: { authorId: req.user!.id },
      include: {
        goals: {
          orderBy: { trackGoalOrder: "asc" },
          select: { id: true, title: true, icon: true, color: true, status: true, trackGoalOrder: true, _count: { select: { milestones: true } } },
        },
        _count: { select: { steps: true, userTracks: true, goals: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(tracks);
  } catch (err) {
    next(err);
  }
}

export async function setTrackGoals(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { goals } = z.object({
      goals: z.array(z.object({ id: z.string(), order: z.number().int() })),
    }).parse(req.body);

    const track = await prisma.track.findFirst({ where: { id: req.params.id, authorId: req.user!.id } });
    if (!track) throw new AppError("Track not found", 404);

    const goalIds = goals.map((g) => g.id);
    if (goalIds.length > 0) {
      const userGoals = await prisma.goal.findMany({ where: { id: { in: goalIds }, userId: req.user!.id } });
      if (userGoals.length !== goalIds.length) throw new AppError("Some goals not found", 404);
    }

    await prisma.$transaction([
      // Clear existing goals from this track
      prisma.goal.updateMany({ where: { programTrackId: req.params.id }, data: { programTrackId: null, trackGoalOrder: 0 } }),
      // Set new goals with their order
      ...goals.map((g) =>
        prisma.goal.update({ where: { id: g.id }, data: { programTrackId: req.params.id, trackGoalOrder: g.order } })
      ),
    ]);

    const updated = await prisma.track.findUnique({
      where: { id: req.params.id },
      include: {
        goals: {
          orderBy: { trackGoalOrder: "asc" },
          select: { id: true, title: true, icon: true, color: true, status: true, trackGoalOrder: true, _count: { select: { milestones: true } } },
        },
        _count: { select: { steps: true, userTracks: true, goals: true } },
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function reactToTrack(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { type } = z.object({ type: z.nativeEnum(ReactionType).nullable() }).parse(req.body);
    const track = await prisma.track.findFirst({ where: { id: req.params.id, isPublic: true } });
    if (!track) throw new AppError("Track not found", 404);

    const existing = await prisma.trackReaction.findUnique({
      where: { userId_trackId: { userId: req.user!.id, trackId: req.params.id } },
    });

    await prisma.$transaction(async (tx) => {
      // Remove old reaction counters
      if (existing) {
        const field = existing.type === ReactionType.LIKE ? "likes" : "dislikes";
        await tx.track.update({ where: { id: req.params.id }, data: { [field]: { decrement: 1 } } });
        await tx.trackReaction.delete({ where: { userId_trackId: { userId: req.user!.id, trackId: req.params.id } } });
      }
      // Add new reaction if not null (toggle off sends null)
      if (type !== null) {
        await tx.trackReaction.create({ data: { userId: req.user!.id, trackId: req.params.id, type } });
        const field = type === ReactionType.LIKE ? "likes" : "dislikes";
        await tx.track.update({ where: { id: req.params.id }, data: { [field]: { increment: 1 } } });
      }
    });

    const updated = await prisma.track.findUnique({ where: { id: req.params.id }, select: { likes: true, dislikes: true } });
    const userReaction = type !== null ? type : null;
    res.json({ ...updated, userReaction });
  } catch (err) {
    next(err);
  }
}

export async function getMyReaction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const reaction = await prisma.trackReaction.findUnique({
      where: { userId_trackId: { userId: req.user!.id, trackId: req.params.id } },
    });
    res.json({ userReaction: reaction?.type ?? null });
  } catch (err) {
    next(err);
  }
}

// Reviewer/Admin: edit any track
export async function adminUpdateTrack(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { steps, ...rest } = trackSchema.partial().extend({ isPublic: z.boolean().optional() }).parse(req.body);
    const track = await prisma.track.findUnique({ where: { id: req.params.id } });
    if (!track) throw new AppError("Track not found", 404);
    const updated = await prisma.track.update({
      where: { id: req.params.id },
      data: rest,
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        goals: { select: { id: true, title: true, icon: true, color: true, status: true, _count: { select: { milestones: true } } } },
        _count: { select: { steps: true, userTracks: true, goals: true } },
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// Reviewer/Admin: delete any track
export async function adminDeleteTrack(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const track = await prisma.track.findUnique({ where: { id: req.params.id } });
    if (!track) throw new AppError("Track not found", 404);
    await prisma.track.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
