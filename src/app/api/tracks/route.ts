// src/app/api/tracks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

// 🟢 GET /api/tracks  → list all tracks
export async function GET() {
  try {
    const tracks = await prisma.track.findMany({
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json(tracks);
  } catch (err) {
    console.error("Error fetching tracks:", err);
    return NextResponse.json(
      { error: "Failed to fetch tracks" },
      { status: 500 }
    );
  }
}

// 🟢 POST /api/tracks  → upload a new track
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null) || "Untitled";
    const artist = (formData.get("artist") as string | null) || "Unknown";

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Ensure uploads folder exists
    const uploadsDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    // Clean name + unique prefix
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_ ]/g, "_");
    const uniqueName = `${Date.now()}-${safeName}`;
    const filePath = path.join(uploadsDir, uniqueName);

    // Write file to disk
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    // URL used by the audio player
    const fileUrl = `/api/audio/${encodeURIComponent(uniqueName)}`;

    const track = await prisma.track.create({
      data: {
        title,
        artist,
        fileUrl,
      },
    });

    return NextResponse.json(track, { status: 201 });
  } catch (err) {
    console.error("Error uploading track:", err);
    return NextResponse.json(
      { error: "Failed to upload track" },
      { status: 500 }
    );
  }
}
