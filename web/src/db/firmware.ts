import { desc, eq } from "drizzle-orm";
import { db } from "./index";
import { firmwareUploads, type FirmwareUpload } from "./schema";

/** Metadata for a stored firmware image (everything except the raw bytes). */
export type FirmwareMeta = Omit<FirmwareUpload, "data">;

const META_COLUMNS = {
  id: firmwareUploads.id,
  version: firmwareUploads.version,
  filename: firmwareUploads.filename,
  size: firmwareUploads.size,
  md5: firmwareUploads.md5,
  notes: firmwareUploads.notes,
  uploadedAt: firmwareUploads.uploadedAt,
};

/** List stored images, newest first. Metadata only — never loads the blobs. */
export async function listFirmware(): Promise<FirmwareMeta[]> {
  return db
    .select(META_COLUMNS)
    .from(firmwareUploads)
    .orderBy(desc(firmwareUploads.uploadedAt));
}

/** One image's metadata by id (no blob). */
export async function getFirmwareMeta(id: string): Promise<FirmwareMeta | null> {
  const [row] = await db
    .select(META_COLUMNS)
    .from(firmwareUploads)
    .where(eq(firmwareUploads.id, id));
  return row ?? null;
}

/** The raw image bytes + content metadata, for streaming to the device. */
export async function getFirmwareData(
  id: string,
): Promise<{ data: Buffer; filename: string; size: number; md5: string } | null> {
  const [row] = await db
    .select({
      data: firmwareUploads.data,
      filename: firmwareUploads.filename,
      size: firmwareUploads.size,
      md5: firmwareUploads.md5,
    })
    .from(firmwareUploads)
    .where(eq(firmwareUploads.id, id));
  if (!row) return null;
  return { ...row, data: Buffer.from(row.data) };
}

/** Store a new image. Returns its metadata. */
export async function insertFirmware(input: {
  version: string;
  filename: string;
  size: number;
  md5: string;
  notes?: string;
  data: Buffer;
}): Promise<FirmwareMeta> {
  const [row] = await db
    .insert(firmwareUploads)
    .values({
      version: input.version,
      filename: input.filename,
      size: input.size,
      md5: input.md5,
      notes: input.notes ?? "",
      data: input.data,
    })
    .returning(META_COLUMNS);
  return row;
}

/** Delete an image. Returns whether a row was removed. */
export async function deleteFirmware(id: string): Promise<boolean> {
  const deleted = await db
    .delete(firmwareUploads)
    .where(eq(firmwareUploads.id, id))
    .returning({ id: firmwareUploads.id });
  return deleted.length > 0;
}
