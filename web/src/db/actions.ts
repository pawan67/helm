import { randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "./index";
import { actionLinks, type ActionLink } from "./schema";
import type { ScheduleAction } from "@/lib/schedule";

export async function listActionLinks(): Promise<ActionLink[]> {
  return db.select().from(actionLinks).orderBy(asc(actionLinks.createdAt));
}

/** Look up a link by its URL secret (the fire endpoint's only auth). */
export async function getActionByKey(key: string): Promise<ActionLink | null> {
  const [row] = await db.select().from(actionLinks).where(eq(actionLinks.key, key));
  return row ?? null;
}

export async function createActionLink(input: {
  label: string;
  deviceId: string;
  action: ScheduleAction;
}): Promise<ActionLink> {
  const key = randomBytes(16).toString("hex"); // 32 hex chars, unguessable
  const [row] = await db
    .insert(actionLinks)
    .values({ label: input.label, key, deviceId: input.deviceId, action: input.action })
    .returning();
  return row;
}

export async function deleteActionLink(id: string): Promise<boolean> {
  const rows = await db
    .delete(actionLinks)
    .where(eq(actionLinks.id, id))
    .returning({ id: actionLinks.id });
  return rows.length > 0;
}
