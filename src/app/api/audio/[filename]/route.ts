// src/app/api/audio/[filename]/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

function getUploadDir() {
  if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
    return "/tmp/mood-dj-uploads";
  }
  return path.join(process.cwd(), "uploads");
}

function getContentType(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  return "application/octet-stream";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    if (!filename) {
      return new NextResponse("Missing filename", { status: 400 });
    }

    // Basic security
    if (filename.includes("..") || filename.includes("/")) {
      return new NextResponse("Bad request", { status: 400 });
    }

    const uploadDir = getUploadDir();
    const filePath = path.join(uploadDir, filename);

    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(filePath);
    } catch {
      console.error("File not found at path:", filePath);
      return new NextResponse("File not found", { status: 404 });
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": getContentType(filename),
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    console.error("GET /api/audio/[filename] error:", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
