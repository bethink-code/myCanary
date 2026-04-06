import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import {
  findUserByEmail,
  updateUser,
  createAccessRequest,
  getAccessRequests,
  updateAccessRequest,
  getAllUsers,
  getInvitedUsers,
  addInvitedUser,
  removeInvitedUser,
} from "./storage";
import { logAudit } from "./auditLog";
import { db } from "./db";
import { auditLogs } from "../shared/schema";
import { desc } from "drizzle-orm";

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Not authenticated" });
}

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && (req.user as any)?.isAdmin) return next();
  res.status(403).json({ message: "Admin access required" });
}

export function registerRoutes(router: Router) {
  // ─── Auth ────────────────────────────────────────
  router.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) return res.json(null);
    const u = req.user as any;
    res.json({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      profileImageUrl: u.profileImageUrl,
      isAdmin: u.isAdmin,
      termsAcceptedAt: u.termsAcceptedAt,
    });
  });

  // ─── Terms Acceptance ────────────────────────────
  router.post("/api/user/accept-terms", isAuthenticated, async (req, res) => {
    const user = req.user as any;
    await updateUser(user.id, { termsAcceptedAt: new Date() });
    logAudit(req, "TERMS_ACCEPTED", { resourceType: "User", resourceId: String(user.id) });
    res.json({ ok: true });
  });

  // ─── Access Requests (public) ────────────────────
  const accessRequestSchema = z.object({
    name: z.string().min(1).max(255),
    email: z.string().email().max(255),
    cell: z.string().max(50).optional(),
  });

  router.post("/api/request-access", async (req, res) => {
    const parsed = accessRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const result = await createAccessRequest(parsed.data);
    res.json(result[0]);
  });

  // ─── Admin: Users ────────────────────────────────
  router.get("/api/admin/users", isAdmin, async (_req, res) => {
    const result = await getAllUsers();
    res.json(result);
  });

  router.patch("/api/admin/users/:id/admin", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { isAdmin: makeAdmin } = req.body;
    const updated = await updateUser(id, { isAdmin: !!makeAdmin });
    logAudit(req, "TOGGLE_ADMIN", {
      resourceType: "User",
      resourceId: String(id),
      detail: `Set isAdmin=${!!makeAdmin}`,
    });
    res.json(updated);
  });

  // ─── Admin: Invites ──────────────────────────────
  router.get("/api/admin/invites", isAdmin, async (_req, res) => {
    const result = await getInvitedUsers();
    res.json(result);
  });

  router.post("/api/admin/invites", isAdmin, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    const user = req.user as any;
    const result = await addInvitedUser(email, user.id);
    logAudit(req, "INVITE_CREATED", { resourceType: "Invite", detail: email });
    res.json(result[0]);
  });

  router.delete("/api/admin/invites/:id", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await removeInvitedUser(id);
    logAudit(req, "INVITE_REMOVED", { resourceType: "Invite", resourceId: String(id) });
    res.json({ ok: true });
  });

  // ─── Admin: Access Requests ──────────────────────
  router.get("/api/admin/access-requests", isAdmin, async (_req, res) => {
    const result = await getAccessRequests();
    res.json(result);
  });

  router.patch("/api/admin/access-requests/:id", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!["approved", "declined"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'approved' or 'declined'" });
    }
    const result = await updateAccessRequest(id, status);
    logAudit(req, "ACCESS_REQUEST_" + status.toUpperCase(), {
      resourceType: "AccessRequest",
      resourceId: String(id),
    });
    res.json(result[0]);
  });

  // ─── Admin: Audit Logs ───────────────────────────
  router.get("/api/admin/audit-logs", isAdmin, async (_req, res) => {
    const result = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);
    res.json(result);
  });

  // ─── Admin: Security Overview ────────────────────
  router.get("/api/admin/security-overview", isAdmin, async (_req, res) => {
    const allUsers = await getAllUsers();
    const admins = allUsers.filter((u) => u.isAdmin);
    res.json({
      totalUsers: allUsers.length,
      adminCount: admins.length,
      recentLogins: allUsers
        .filter((u) => u.createdAt)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10),
    });
  });

  return router;
}
