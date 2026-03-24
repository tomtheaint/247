import { Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient, Role, GoalCategory, TrackDifficulty, Priority } from "@prisma/client";
import { AuthRequest, paginate } from "../types";
import { AppError } from "../middleware/errorHandler";

const prisma = new PrismaClient();

export async function listUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const search = req.query.q as string | undefined;

    const where = search
      ? { OR: [{ email: { contains: search, mode: "insensitive" as const } }, { username: { contains: search, mode: "insensitive" as const } }] }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, username: true, displayName: true, role: true, isPublic: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);

    res.json(paginate(users, total, page, limit));
  } catch (err) {
    next(err);
  }
}

export async function seedTestData(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const day = (offset: number) => new Date(now.getTime() + offset * 86400000);

    // ── Goals ──────────────────────────────────────────────────────────────
    const [goalSpanish, goalRun, goalRead] = await Promise.all([
      prisma.goal.create({
        data: {
          title: "Learn Spanish",
          description: "Reach conversational Spanish in 6 months",
          category: GoalCategory.LEARNING,
          color: "#6366f1",
          icon: "🇪🇸",
          userId,
        },
      }),
      prisma.goal.create({
        data: {
          title: "Run a 5K",
          description: "Train from couch to 5K in 8 weeks",
          category: GoalCategory.FITNESS,
          color: "#f97316",
          icon: "🏃",
          userId,
        },
      }),
      prisma.goal.create({
        data: {
          title: "Read 12 Books",
          description: "Read one book per month this year",
          category: GoalCategory.LEARNING,
          color: "#10b981",
          icon: "📚",
          userId,
        },
      }),
    ]);

    // ── Events for each goal ───────────────────────────────────────────────
    const makeEvent = (
      title: string,
      goalId: string,
      startOffset: number,
      durationMinutes: number,
      priority: Priority = Priority.NORMAL,
    ) => {
      const start = day(startOffset);
      start.setHours(18, 0, 0, 0);
      const end = new Date(start.getTime() + durationMinutes * 60000);
      return { title, goalId, userId, startTime: start, endTime: end, priority };
    };

    await prisma.event.createMany({
      data: [
        makeEvent("Spanish: Alphabet & Pronunciation", goalSpanish.id, -3, 45),
        makeEvent("Spanish: Basic Greetings", goalSpanish.id, -1, 60),
        makeEvent("Spanish: Numbers & Colors", goalSpanish.id, 1, 45),
        makeEvent("Spanish: Present Tense Verbs", goalSpanish.id, 3, 60, Priority.HIGH),
        makeEvent("Run: Easy 20 min jog", goalRun.id, -2, 30),
        makeEvent("Run: Intervals 30 min", goalRun.id, 0, 35),
        makeEvent("Run: Long run 40 min", goalRun.id, 2, 45, Priority.HIGH),
        makeEvent("Reading session: Chapter 1–3", goalRead.id, -4, 60),
        makeEvent("Reading session: Chapter 4–6", goalRead.id, -1, 60),
        makeEvent("Reading session: Chapter 7–9", goalRead.id, 2, 60),
      ],
    });

    // ── Track (with goals linked) ──────────────────────────────────────────
    const track = await prisma.track.create({
      data: {
        title: "Conversational Spanish in 90 Days",
        description: "A structured 90-day program using spaced repetition and daily speaking practice.",
        category: GoalCategory.LEARNING,
        difficulty: TrackDifficulty.BEGINNER,
        estimatedDays: 90,
        isPublic: true,
        tags: ["language", "spanish", "beginner"],
        authorId: userId,
        goals: { connect: { id: goalSpanish.id } },
        steps: {
          create: [
            { title: "Alphabet & Pronunciation", description: "Master Spanish letters and sounds.", dayOffset: 0, durationMinutes: 45, order: 1 },
            { title: "Basic Greetings", description: "Learn 50 essential phrases for introductions.", dayOffset: 1, durationMinutes: 60, order: 2 },
            { title: "Numbers & Colors", description: "Numbers 1–100 and color vocabulary.", dayOffset: 3, durationMinutes: 45, order: 3 },
            { title: "Present Tense Verbs", description: "Top 20 irregular verbs conjugated.", dayOffset: 7, durationMinutes: 60, order: 4 },
          ],
        },
      },
    });

    res.json({
      goals: [goalSpanish.id, goalRun.id, goalRead.id],
      trackId: track.id,
      eventsCreated: 10,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateUserRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.params.id === req.user!.id) throw new AppError("Cannot change your own role", 400);

    const { role } = z.object({ role: z.nativeEnum(Role) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError("User not found", 404);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, email: true, username: true, displayName: true, role: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
