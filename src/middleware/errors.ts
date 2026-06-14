import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wraps async route handlers so thrown errors reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "invalid_request",
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  // Surface upstream LLM/auth errors without leaking secrets.
  console.error("[ai-server] error:", message);
  return res.status(500).json({ error: "internal_error", message });
}
