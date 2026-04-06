import { db } from "./db";
import { eq } from "drizzle-orm";
import {
  users,
  invitedUsers,
  accessRequests,
  auditLogs,
} from "../shared/schema";

export async function findUserByEmail(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email));
  return result[0] ?? null;
}

export async function createUser(data: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}) {
  const result = await db.insert(users).values(data).returning();
  return result[0];
}

export async function updateUser(id: number, data: Partial<typeof users.$inferInsert>) {
  const result = await db.update(users).set(data).where(eq(users.id, id)).returning();
  return result[0];
}

export async function isEmailInvited(email: string): Promise<boolean> {
  const result = await db
    .select()
    .from(invitedUsers)
    .where(eq(invitedUsers.email, email.toLowerCase()));
  return result.length > 0;
}

export async function getInvitedUsers() {
  return db.select().from(invitedUsers);
}

export async function addInvitedUser(email: string, invitedBy: number) {
  return db
    .insert(invitedUsers)
    .values({ email: email.toLowerCase(), invitedBy })
    .returning();
}

export async function removeInvitedUser(id: number) {
  return db.delete(invitedUsers).where(eq(invitedUsers.id, id));
}

export async function createAccessRequest(data: {
  name: string;
  email: string;
  cell?: string;
}) {
  return db.insert(accessRequests).values(data).returning();
}

export async function getAccessRequests() {
  return db.select().from(accessRequests);
}

export async function updateAccessRequest(id: number, status: string) {
  return db
    .update(accessRequests)
    .set({ status })
    .where(eq(accessRequests.id, id))
    .returning();
}

export async function createAuditLog(data: {
  userId?: number;
  action: string;
  resourceType?: string;
  resourceId?: string;
  outcome?: string;
  detail?: string;
  ipAddress?: string;
  beforeValue?: unknown;
  afterValue?: unknown;
}) {
  try {
    await db.insert(auditLogs).values(data as any);
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

export async function getAllUsers() {
  return db.select().from(users);
}
