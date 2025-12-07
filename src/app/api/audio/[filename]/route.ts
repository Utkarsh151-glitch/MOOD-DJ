// src/app/api/audio/[filename]/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

function getContentType(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  return "application/octet-stream";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const { filename } = params;

  if (!filename || filename.includes("..")) {
    return NextResponse.json(
      { error: "Invalid filename" },
      { status: 400 }
    );
  }

  const filePath = path.join(UPLOAD_DIR, filename);

  try {
    const fileBuffer = await fs.readFile(filePath);

    // 👇 The important part: cast Buffer → BodyInit for TS
    return new NextResponse(fileBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": getContentType(filename),
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("Error reading audio file:", err);

    if (err?.code === "ENOENT") {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Error reading file" },
      { status: 500 }
    );
  }
}
