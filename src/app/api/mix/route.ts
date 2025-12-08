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

    // 2) Get AI playlist (or heuristic, handled inside getAiPlaylist)
    let trackIds = await getAiPlaylist(mood, tracks);

    // Validate IDs against existing tracks
    const validIdSet = new Set(tracks.map((t) => t.id));
    trackIds = trackIds.filter((id) => validIdSet.has(id));

    // If still too few, pad with recent tracks
    if (trackIds.length < 3) {
      const recentIds = tracks.map((t) => t.id);
      for (const id of recentIds) {
        if (trackIds.length >= 3) break;
        if (!trackIds.includes(id)) {
          trackIds.push(id);
        }
      }
      trackIds = trackIds.slice(0, Math.min(6, trackIds.length));
    }

    if (trackIds.length === 0) {
      return NextResponse.json(
        { error: "Could not generate a valid mix. Try uploading more tracks." },
        { status: 400 }
      );
    }

    // 3) Save Mix + PlaylistTrack (your schema: Mix + PlaylistTrack)
    const mix = await prisma.mix.create({
      data: {
        moodPrompt: mood,
        tracks: {
          create: trackIds.map((trackId, index) => ({
            track: { connect: { id: trackId } },
            order: index,
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

    // 4) Shape response for frontend
    const orderedTracks = mix.tracks.map((mt) => ({
      id: mt.track.id,
      title: mt.track.title,
      artist: mt.track.artist,
      fileUrl: mt.track.fileUrl,
      order: mt.order,
    }));

    const response = {
      id: mix.id,
      name: `Mood Mix – ${mood}`,
      mood,
      createdAt: mix.createdAt,
      source: process.env.OPENAI_API_KEY ? "llm+fallback" : "heuristic",
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
