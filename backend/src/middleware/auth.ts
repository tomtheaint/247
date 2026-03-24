import { Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../utils/jwt";
import { AuthRequest } from "../types";

const prisma = new PrismaClient();

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }
  try {
    const token = header.slice(7);
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { role: true } });
      if (!user || !roles.includes(user.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      next();
    } catch {
      res.status(403).json({ error: "Forbidden" });
    }
  };
}
