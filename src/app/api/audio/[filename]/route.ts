// src/app/api/audio/[filename]/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

function getContentType(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  return "application/octet-stream";
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  // 🔑 Next.js gives params as a Promise in this route type, so we await it
  const { filename } = await context.params;

  if (!filename) {
    return NextResponse.json({ error: "Filename is required" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "uploads", filename);

  try {
    const fileBuffer = await fs.readFile(filePath);

    // ✅ Convert Node Buffer to Uint8Array so it's valid BodyInit for NextResponse
    const uint8 = new Uint8Array(fileBuffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type": getContentType(filename),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    if (err.code === "ENOENT") {
      console.error("File not found at path:", filePath);
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    console.error("Error reading file:", err);
    return NextResponse.json(
      { error: "Error reading audio file" },
      { status: 500 }
    );
  }
}
