// src/app/api/mix/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAiPlaylist, AiPlaylistResult } from "@/lib/llm";
import { clearTopTracksCache } from "@/lib/topTracksCache";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mood = (body.mood as string | undefined)?.trim() || "chill";

    const tracks = await prisma.track.findMany({
      orderBy: { uploadedAt: "desc" },
    });

    if (tracks.length === 0) {
      return NextResponse.json(
        { error: "No tracks available. Please upload some first." },
        { status: 400 }
      );
    }

    // infer type of one track from the array
    type TrackRow = (typeof tracks)[number];

    let aiResult: AiPlaylistResult;
    try {
      aiResult = await getAiPlaylist(mood, tracks);
    } catch (err) {
      console.error("[/api/mix] getAiPlaylist failed, using fallback:", err);

      // explicit types so TS is happy
      const fallbackSelection = tracks
        .slice(0, Math.min(6, tracks.length))
        .map((t: TrackRow, index: number): { trackId: number; order: number } => ({
          trackId: t.id,
          order: index,
        }));

      aiResult = { selection: fallbackSelection, usedAi: false };
    }

    const selection = aiResult.selection;

    // Save Mix + PlaylistTrack rows
    const mix = await prisma.mix.create({
      data: {
        moodPrompt: mood,
        tracks: {
          create: selection.map((item) => ({
            trackId: item.trackId,
            order: item.order,
            weight: 1,
          })),
        },
      },
      include: {
        tracks: {
          include: { track: true },
          orderBy: { order: "asc" },
        },
      },
    });

    clearTopTracksCache();

    const responsePayload = {
      id: mix.id,
      mood: mix.moodPrompt,
      createdAt: mix.createdAt,
      source: aiResult.usedAi ? "openai" : "fallback",
      tracks: mix.tracks.map((pt) => ({
        id: pt.track.id,
        title: pt.track.title,
        artist: pt.track.artist,
        fileUrl: pt.track.fileUrl,
        order: pt.order,
      })),
    };

    return NextResponse.json(responsePayload);
  } catch (err) {
    console.error("[/api/mix] Error generating mix:", err);
    return NextResponse.json(
      { error: "Internal error generating mix" },
      { status: 500 }
    );
  }
}
