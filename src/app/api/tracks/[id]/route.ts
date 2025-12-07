// src/app/api/tracks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

// 🗑 DELETE /api/tracks/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ⬅️ This is the important fix: await params
    const { id } = await params;
    const trackId = Number(id);

    if (Number.isNaN(trackId)) {
      return NextResponse.json({ error: "Invalid track id" }, { status: 400 });
    }

    const track = await prisma.track.findUnique({
      where: { id: trackId },
    });

    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    // Try to delete the audio file if it's local
    if (track.fileUrl && track.fileUrl.startsWith("/api/audio/")) {
      const filename = decodeURIComponent(
        track.fileUrl.replace("/api/audio/", "")
      );
      const filePath = path.join(process.cwd(), "uploads", filename);

      try {
        await fs.unlink(filePath);
      } catch (err: any) {
        // ENOENT = file already missing → ignore
        if (err.code !== "ENOENT") {
          console.error("Error deleting file:", err);
        }
      }
    }

    // Clean up any playlist relations if you use them
    try {
      await prisma.playlistTrack.deleteMany({
        where: { trackId },
      });
    } catch (e) {
      // if PlaylistTrack table doesn't exist, ignore silently
      console.warn("playlistTrack cleanup skipped or failed:", e);
    }

    // Delete DB row
    await prisma.track.delete({
      where: { id: trackId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting track:", err);
    return NextResponse.json(
      { error: "Failed to delete track" },
      { status: 500 }
    );
  }
}
