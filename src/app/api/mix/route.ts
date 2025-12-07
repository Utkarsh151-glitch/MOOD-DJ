// src/app/api/mix/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAiPlaylist } from "@/lib/llm";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mood = (body.mood as string | undefined)?.trim() || "chill";

    // 1) Load all tracks from DB
    const tracks = await prisma.track.findMany({
      orderBy: { uploadedAt: "desc" },
    });

    if (tracks.length === 0) {
      return NextResponse.json(
        { error: "No tracks available. Please upload some first." },
        { status: 400 }
      );
    }

    // 2) Let AI (or heuristic) choose and order tracks
    let selection: { trackId: number; order: number }[];

    try {
      selection = await getAiPlaylist(mood, tracks);
    } catch (err) {
      console.error("[llm] OpenAI error inside /api/mix:", err);

      // Fallback heuristic: just take 3–6 most recent tracks
      const min = 3;
      const max = 6;
      const count = Math.min(
        Math.max(min, Math.floor(tracks.length / 2) || min),
        max,
      );

      selection = tracks.slice(0, count).map((t, index) => ({
        trackId: t.id,
        order: index,
      }));
    }

    // 3) Build ordered track list (no DB playlist write here; we only return JSON)
    const orderedTracks = selection
      .map((sel) => {
        const t = tracks.find((tr) => tr.id === sel.trackId);
        if (!t) return null;
        return {
          id: t.id,
          title: t.title,
          artist: t.artist,
          fileUrl: t.fileUrl,
          order: sel.order,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.order - b!.order) as {
      id: number;
      title: string;
      artist: string | null;
      fileUrl: string;
      order: number;
    }[];

    const response = {
      id: null, // not creating a Playlist row in DB in this simplified version
      name: `Mood Mix – ${mood}`,
      mood,
      createdAt: new Date().toISOString(),
      source:
        process.env.ENABLE_REMOTE_LLM === "true"
          ? "llm+heuristic"
          : "heuristic",
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
