// src/app/api/tracks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

// GET /api/tracks → list tracks
export async function GET() {
  try {
    const tracks = await prisma.track.findMany({
      orderBy: { uploadedAt: "desc" },
    });
    return NextResponse.json(tracks);
  } catch (err) {
    console.error("[GET /api/tracks] error:", err);
    return NextResponse.json(
      { error: "Failed to load tracks" },
      { status: 500 }
    );
  }
}

// POST /api/tracks → upload new track
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file = formData.get("file");
    const title = (formData.get("title") as string) || "Untitled";
    const artist = (formData.get("artist") as string) || null;
    const originalName =
      (formData.get("originalName") as string) || "upload.mp3";

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadsDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const safeName = `${Date.now()}-${originalName}`.replace(
      /[^a-zA-Z0-9.\-_ ]/g,
      "_"
    );
    const filePath = path.join(uploadsDir, safeName);

    await fs.writeFile(filePath, buffer);

    const track = await prisma.track.create({
      data: {
        title,
        artist,
        fileUrl: `/api/audio/${encodeURIComponent(safeName)}`,
      },
    });

    return NextResponse.json(track, { status: 201 });
  } catch (err) {
    console.error("[POST /api/tracks] error:", err);
    return NextResponse.json(
      { error: "Failed to upload track" },
      { status: 500 }
    );
  }
}
