// src/app/api/stats/top-tracks/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tracks = await prisma.track.findMany({
      orderBy: { uploadedAt: "desc" },
      take: 5,
    });

    return NextResponse.json({
      source: "db",
      data: tracks.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        fileUrl: t.fileUrl,
        moodTag: t.moodTag,
      })),
    });
  } catch (err) {
    console.error("[/api/stats/top-tracks] error:", err);
    return NextResponse.json(
      { error: "Failed to load top tracks" },
      { status: 500 }
    );
  }
}
