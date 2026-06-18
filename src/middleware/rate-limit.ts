import type { NextFunction, Request, Response } from "express";
import { config, isSupabaseConfigured } from "../config.js";
import { countSince } from "../repositories/usage.js";
import { HttpError } from "./errors.js";

/**
 * Per-user rolling-window rate limit, backed by usage_events. Only enforced for
 * authenticated requests when Supabase is configured (anonymous/dev requests are
 * not limited here). Place AFTER requireAuth and BEFORE the handler.
 */
export async function rateLimit(req: Request, _res: Response, next: NextFunction) {
  if (!isSupabaseConfigured() || !req.user || !req.db) return next();
  try {
    const sinceIso = new Date(
      Date.now() - config.rateLimit.windowSeconds * 1000
    ).toISOString();
    const used = await countSince(req.db, req.user.id, sinceIso);
    if (used >= config.rateLimit.maxRequests) {
      _res.setHeader("Retry-After", String(config.rateLimit.windowSeconds));
      return next(
        new HttpError(
          429,
          `Rate limit exceeded: max ${config.rateLimit.maxRequests} requests per ${config.rateLimit.windowSeconds}s.`
        )
      );
    }
  } catch (err) {
    // Fail open: never block a request because the limiter's own query failed.
    console.warn("[rate-limit] check failed, allowing request:", String(err));
  }
  next();
}
