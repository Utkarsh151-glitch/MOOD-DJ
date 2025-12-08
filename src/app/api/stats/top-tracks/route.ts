// src/app/api/stats/top-tracks/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTopTracksCache, setTopTracksCache } from "@/lib/topTracksCache";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cached = getTopTracksCache();
    if (cached) {
      return NextResponse.json({ source: "cache", data: cached });
    }

    const grouped = await prisma.playlistTrack.groupBy({
      by: ["trackId"],
      _count: { trackId: true },
      orderBy: { _count: { trackId: "desc" } },
      take: 10,
    });

    const trackIds = grouped.map((g) => g.trackId);

    if (trackIds.length === 0) {
      return NextResponse.json({ source: "db", data: [] });
    }

    const tracks = await prisma.track.findMany({
      where: { id: { in: trackIds } },
    });

    const result = grouped.map((g) => {
      const t = tracks.find((tr) => tr.id === g.trackId)!;
      return {
        id: t.id,
        title: t.title,
        artist: t.artist,
        fileUrl: t.fileUrl,
        uses: g._count.trackId,
      };
    });

    setTopTracksCache(result);

    return NextResponse.json({ source: "db", data: result });
  } catch (err) {
    console.error("[/api/stats/top-tracks] error:", err);
    return NextResponse.json(
      { error: "Failed to load top tracks" },
      { status: 500 }
    );
  }
}
