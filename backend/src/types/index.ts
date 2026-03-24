import { Request } from "express";

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

export interface JwtPayload {
  id: string;
  email: string;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}
