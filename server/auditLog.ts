import { createAuditLog } from "./storage";
import type { Request } from "express";

export function logAudit(
  req: Request,
  action: string,
  opts: {
    resourceType?: string;
    resourceId?: string;
    outcome?: string;
    detail?: string;
    beforeValue?: unknown;
    afterValue?: unknown;
  } = {}
) {
  const userId = (req.user as any)?.id;
  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";

  // Fire and forget
  createAuditLog({
    userId,
    action,
    ipAddress,
    ...opts,
  });
}
