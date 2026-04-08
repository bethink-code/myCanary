import { Request, Response, NextFunction } from "express";

/**
 * Client context middleware.
 * Phase 0: hardcoded to client_id = 1 (THH).
 * Phase 4: will resolve from subdomain (e.g., thh.mycanary.biz → client_id 1).
 */
export function clientContext(req: Request, _res: Response, next: NextFunction) {
  // TODO Phase 4: extract subdomain from req.hostname, look up client from DB
  (req as any).clientId = 1;
  next();
}

/** Helper to read clientId from the request. */
export function getClientId(req: Request): number {
  return (req as any).clientId;
}
