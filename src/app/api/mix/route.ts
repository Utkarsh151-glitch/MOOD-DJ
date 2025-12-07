// src/app/api/mix/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAiPlaylist } from "@/lib/llm";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mood = (body.mood as string | undefined)?.trim() || "chill";

    // 1) Load all tracks
    const tracks = await prisma.track.findMany({
      orderBy: { uploadedAt: "desc" },
    });

    if (tracks.length === 0) {
      return NextResponse.json(
        { error: "No tracks available. Please upload some first." },
        { status: 400 }
      );
    }

    // 2) Ask LLM (or fallback) which IDs to use
    const { trackIds, usedAi } = await getAiPlaylist(mood, tracks);

    if (!trackIds.length) {
      return NextResponse.json(
        { error: "AI could not build a mix. Try a different mood." },
        { status: 500 }
      );
    }

    // 3) Build ordered track list from those IDs
    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    const orderedTracks = trackIds
      .map((id, index) => {
        const t = trackMap.get(id);
        if (!t) return null;
        return {
          id: t.id,
          title: t.title,
          artist: t.artist,
          fileUrl: t.fileUrl,
          moodTag: t.moodTag,
          order: index,
        };
      })
      .filter(Boolean) as {
      id: number;
      title: string;
      artist: string | null;
      fileUrl: string;
      moodTag: string | null;
      order: number;
    }[];

    const response = {
      id: null, // not stored as DB playlist
      name: `Mood Mix – ${mood}`,
      mood,
      createdAt: new Date().toISOString(),
      source: usedAi ? "llm" : "heuristic",
      tracks: orderedTracks,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[/api/mix] Error generating mix:", err);
    return NextResponse.json(
      { error: "Internal error generating mix" },
      { status: 500 }
    );
  }
}
        