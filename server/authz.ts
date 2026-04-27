import type { NextFunction, Request, Response } from "express";
import type { User } from "../drizzle/schema";
import { createContext } from "./_core/context";
import * as db from "./db";

export type ResolvedAuth = {
  user: User;
  role: db.AdminRole | null;
};

export async function resolveRequestAuth(
  req: Request,
  res: Response
): Promise<ResolvedAuth | null> {
  const ctx = await createContext({ req, res } as any);
  if (!ctx.user) return null;
  const role = await db.getEffectiveAdminRole(ctx.user);
  return {
    user: ctx.user,
    role,
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const resolved = await resolveRequestAuth(req, res);
    if (!resolved) {
      res.status(401).json({ ok: false, error: "Authentication required." });
      return;
    }
    (req as any).auth = resolved;
    next();
  } catch (error) {
    console.error("[AuthZ] requireAuth failed:", error);
    res.status(401).json({ ok: false, error: "Authentication failed." });
  }
}

export function requireRole(roles: db.AdminRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = (req as any).auth as ResolvedAuth | undefined;
      const resolved = existing ?? (await resolveRequestAuth(req, res));
      if (!resolved) {
        res.status(401).json({ ok: false, error: "Authentication required." });
        return;
      }
      if (!resolved.role || !roles.includes(resolved.role)) {
        res.status(403).json({ ok: false, error: "Insufficient permissions." });
        return;
      }
      (req as any).auth = resolved;
      next();
    } catch (error) {
      console.error("[AuthZ] requireRole failed:", error);
      res.status(401).json({ ok: false, error: "Authentication failed." });
    }
  };
}

