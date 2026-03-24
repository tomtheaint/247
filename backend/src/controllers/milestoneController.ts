import { Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../types";
import { AppError } from "../middleware/errorHandler";

const prisma = new PrismaClient();

const milestoneSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  dueDate: z.string().optional(), // date string "YYYY-MM-DD"
  completed: z.boolean().optional(),
});

export async function listMilestones(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const goal = await prisma.goal.findFirst({ where: { id: req.params.goalId, userId: req.user!.id } });
    if (!goal) throw new AppError("Goal not found", 404);

    const milestones = await prisma.milestone.findMany({
      where: { goalId: req.params.goalId },
      orderBy: { dueDate: "asc" },
    });
    res.json(milestones);
  } catch (err) {
    next(err);
  }
}

export async function createMilestone(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const goal = await prisma.goal.findFirst({ where: { id: req.params.goalId, userId: req.user!.id } });
    if (!goal) throw new AppError("Goal not found", 404);

    const body = milestoneSchema.parse(req.body);
    const milestone = await prisma.milestone.create({
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        goalId: req.params.goalId,
      },
    });
    res.status(201).json(milestone);
  } catch (err) {
    next(err);
  }
}

export async function updateMilestone(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const milestone = await prisma.milestone.findFirst({
      where: { id: req.params.id },
      include: { goal: { select: { userId: true } } },
    });
    if (!milestone || milestone.goal.userId !== req.user!.id) throw new AppError("Milestone not found", 404);

    const body = milestoneSchema.partial().parse(req.body);
    const updated = await prisma.milestone.update({
      where: { id: req.params.id },
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        completedAt: body.completed === true ? new Date() : body.completed === false ? null : undefined,
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteMilestone(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const milestone = await prisma.milestone.findFirst({
      where: { id: req.params.id },
      include: { goal: { select: { userId: true } } },
    });
    if (!milestone || milestone.goal.userId !== req.user!.id) throw new AppError("Milestone not found", 404);

    await prisma.milestone.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
