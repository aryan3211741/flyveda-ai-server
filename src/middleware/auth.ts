import type { NextFunction, Request, Response } from "express";
import {
  dbForUser,
  verifyAccessToken,
  type AuthUser,
  type SupabaseClient,
} from "../db/supabase.js";
import { isSupabaseConfigured } from "../config.js";
import { HttpError } from "./errors.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by optionalAuth/requireAuth when a valid Bearer token is present. */
      user?: AuthUser;
      /** Data-access client scoped to the authenticated user (service-role or JWT-forwarding). */
      db?: SupabaseClient;
    }
  }
}

function bearerToken(req: Request): string {
  const header = req.header("authorization") ?? req.header("Authorization") ?? "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token.trim() : "";
}

/**
 * Attaches req.user when a valid token is present, but never rejects. Use on
 * routes that work anonymously but personalize/persist when signed in.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);
    if (token && isSupabaseConfigured()) {
      const user = await verifyAccessToken(token);
      if (user) {
        req.user = user;
        req.db = dbForUser(token);
      }
    }
  } catch {
    // optional: ignore verification failures
  }
  next();
}

/**
 * Rejects with 401 unless a valid Supabase token is present. Use on routes that
 * read or write per-user data.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!isSupabaseConfigured()) {
    return next(
      new HttpError(503, "Authentication is unavailable: Supabase is not configured on the server.")
    );
  }
  const token = bearerToken(req);
  if (!token) return next(new HttpError(401, "Missing Bearer token."));
  const user = await verifyAccessToken(token);
  if (!user) return next(new HttpError(401, "Invalid or expired token."));
  req.user = user;
  req.db = dbForUser(token);
  next();
}
