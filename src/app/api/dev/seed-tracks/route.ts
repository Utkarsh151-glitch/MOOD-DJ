// src/app/api/dev/seed-tracks/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST() {
  try {
    const samples = [
      {
        title: "Calm Piano",
        artist: "Sample Artist",
        fileUrl: "https://samplelib.com/lib/preview/mp3/sample-3s.mp3",
      },
      {
        title: "Ambient Chill",
        artist: "Sample Artist",
        fileUrl: "https://samplelib.com/lib/preview/mp3/sample-6s.mp3",
      },
      {
        title: "Soft Guitar",
        artist: "Sample Artist",
        fileUrl: "https://samplelib.com/lib/preview/mp3/sample-9s.mp3",
      },
    ];

    // Simple seeding – just insert; if you click twice, you'll just get duplicates, which is fine for demo.
    await prisma.track.createMany({
      data: samples,
    });

    const tracks = await prisma.track.findMany({
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json({ count: tracks.length, tracks });
  } catch (err) {
    console.error("POST /api/dev/seed-tracks error:", err);
    return NextResponse.json(
      { error: "Failed to seed demo tracks" },
      { status: 500 }
    );
  }
}
