import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { isAuthed } from "@/lib/auth";
import { listFirmware, insertFirmware } from "@/db/firmware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ESP32 app images are ~1 MB; cap well above that but below anything absurd. */
const MAX_SIZE = 4 * 1024 * 1024;

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ firmware: await listFirmware() });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing firmware file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 4 MB)" }, { status: 413 });
  }

  const data = Buffer.from(await file.arrayBuffer());
  // ESP32 app images begin with the 0xE9 magic byte. Reject anything else so a
  // stray file (or a wrong-target build) can never be pushed to the device.
  if (data[0] !== 0xe9) {
    return NextResponse.json(
      { error: "Not an ESP32 firmware image (expected 0xE9 magic byte)" },
      { status: 400 },
    );
  }

  const md5 = createHash("md5").update(data).digest("hex");

  const versionField = form.get("version");
  const version =
    typeof versionField === "string" && versionField.trim()
      ? versionField.trim().slice(0, 64)
      : file.name.replace(/\.bin$/i, "").slice(0, 64) || "firmware";

  const notesField = form.get("notes");
  const notes = typeof notesField === "string" ? notesField.trim().slice(0, 500) : "";

  const meta = await insertFirmware({
    version,
    filename: file.name.slice(0, 200) || "firmware.bin",
    size: data.length,
    md5,
    notes,
    data,
  });

  return NextResponse.json({ firmware: meta }, { status: 201 });
}
