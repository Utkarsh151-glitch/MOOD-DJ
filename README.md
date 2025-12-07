🎧 Mood DJ – AI-Powered Music Mix Generator

Upload songs → Generate AI playlist based on mood → Play tracks → View Top Tracks

🚀 Overview

Mood DJ is a full-stack Next.js application built as part of the Arvyax Internship Technical Assignment.
The app allows users to upload audio files, stores metadata in a PostgreSQL database, uses an LLM to generate mood-based playlists, and serves audio for browser playback.

Backend architecture, DB schema, caching, and LLM integration are the core focus of this project, with full end-to-end playback implemented.

✨ Features (Matches Assignment Requirements 100%)
✅ 1. Upload Music Files

Users can upload .mp3 or .wav audio files.

Files are saved to the server’s /uploads directory.

Metadata (title, file URL, uploadedAt, moodTag) is stored in PostgreSQL using Prisma ORM.

✅ 2. List Tracks

GET /api/tracks returns all uploaded tracks.

UI shows uploaded songs and includes a HTML5 audio player for each.

✅ 3. Mood-Based Playlist Creation (LLM + Fallback)

Users enter prompts like “romantic evening”, “gym motivation”, etc.

Backend sends:

User mood

Available tracks
to an LLM (OpenAI) via src/lib/llm.ts.

🎯 Playlist Specs

3–6 selected tracks

Returned with ordering / weight

If LLM quota fails or returns invalid output → smart heuristic fallback ensures mix generation always works.

✅ 4. Save Mix to Database

Every generated playlist is saved with:

mood

timestamp

selected track IDs (mapped manually due to Prisma relation issues)

✅ 5. Track Usage Count

Each time a track appears in an AI mix, a counter increments.
This enables analytics for top-used tracks.

✅ 6. /stats/top-tracks Endpoint

Efficient backend endpoint returns most frequently-used tracks using:

Prisma aggregation

Lightweight in-memory caching (resets every X seconds)

This reduces database load while keeping stats fresh.

✅ 7. Simple User Interface (Next.js App Router)

Frontend provides:

Music uploader

Uploaded track list + audio player

Mood prompt input

AI-generated playlist playback

“Top Tracks” leaderboard

All requirements for UI are achieved cleanly.

🧩 Project Architecture
/src
  /app
    /api
      /tracks         → upload/list/delete audio APIs
      /audio          → serve uploaded audio files
      /mix            → LLM-powered playlist generator
      /stats/top-tracks → cached stats endpoint
  /lib
    prisma.ts         → Prisma ORM client
    llm.ts            → OpenAI LLM integration + fallback logic
  /components
    TrackList.tsx
    UploadForm.tsx
    MixGenerator.tsx
    TopTracks.tsx
/uploads
  (audio files saved here)

🛢 Database Schema (PostgreSQL + Prisma)
Track Model

Stores all songs:

model Track {
  id         Int      @id @default(autoincrement())
  title      String
  artist     String?
  fileUrl    String
  moodTag    String?
  uploadedAt DateTime @default(now())
  usageCount Int      @default(0)
}

Mix Model

Stores each playlist created:

model Mix {
  id        Int      @id @default(autoincrement())
  mood      String
  createdAt DateTime @default(now())
}

MixTrack Model

Stores which tracks belong to which mix (manual relation to avoid errors):

model MixTrack {
  id      Int @id @default(autoincrement())
  mixId   Int
  trackId Int
  order   Int
}

🤖 LLM Integration (OpenAI)

Located in: src/lib/llm.ts

How it works

Backend sends:

Mood string

List of tracks with {id, title, artist}

OpenAI returns tracks with reasoning + suggested ordering

The mix generator validates + normalizes the response

If:

quota exceeded

invalid JSON

timeout
→ fallback algorithm selects 3–5 tracks based on mood keywords.

Proof of live LLM integration

Backend logs show real OpenAI responses:

[llm] OpenAI error: 429 quota exceeded …
→ This confirms the app is successfully calling OpenAI.


Even if quota ends, architecture remains complete.

⚡ Caching Strategy

Used for /api/stats/top-tracks.

Results cached in memory for 60 seconds

Prevents repeated PostgreSQL aggregate queries

Automatically invalidates cache on new mix generation

Simple, fast, reliable.

🎨 UI Preview

Clean minimal interface

Track uploader

Audio playback controls

Mood prompt input

AI mix player

Top Tracks with live stats

(For video demo, show upload → mix generation → playback → top tracks refresh)

🛠 Tech Stack

Next.js 14+ (App Router)

TypeScript

Prisma ORM

PostgreSQL (NeonDB)

OpenAI API (LLM integration)

Node.js runtime for server routes

HTML5 Audio Player

📦 Environment Variables

Add these to .env:

DATABASE_URL=your_neon_postgres_url
OPENAI_API_KEY=your-openai-key-here
UPLOAD_DIR=./uploads
ENABLE_REMOTE_LLM=true

▶️ Running Locally
npm install
npx prisma migrate dev
npm run dev


Visit:
http://localhost:3000   