// src/lib/llm.ts
import OpenAI from "openai";
import { Track } from "@prisma/client";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Returns an array of track IDs (number[]) chosen for the mood.
 * Uses OpenAI if API key is present, otherwise falls back to heuristic.
 */
export async function getAiPlaylist(mood: string, tracks: Track[]): Promise<number[]> {
  // If no key, skip remote LLM and use heuristic.
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[llm] No OPENAI_API_KEY set, using heuristic playlist.");
    return heuristicPlaylist(mood, tracks);
  }

  if (tracks.length === 0) return [];

  // Build track list context
  const trackLines = tracks
    .map((t) => `- ${t.id}: "${t.title}" by ${t.artist ?? "Unknown"}`)
    .join("\n");

  const prompt = `
You are an assistant that creates playlists.

The user will give you a mood description. You will see a list of tracks, each with an ID.
Pick between 3 and 6 track IDs that match the mood. 

ONLY reply with a JSON array of numbers (track IDs). Example:
[1, 3, 7]

User mood: "${mood}"

Available tracks:
${trackLines}
  `.trim();

  try {
    const completion: any = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const raw = completion.choices?.[0]?.message?.content ?? "[]";

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Handle ```json ... ``` wrapping
      const cleaned = raw
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      parsed = JSON.parse(cleaned || "[]");
    }

    const allIds = tracks.map((t) => t.id);
    const validIdSet = new Set(allIds);

    const fromModel =
      Array.isArray(parsed)
        ? parsed.filter(
            (id) => typeof id === "number" && validIdSet.has(id)
          )
        : [];

    if (fromModel.length >= 3) {
      return fromModel.slice(0, 6);
    }

    console.warn("[llm] Model returned too few valid IDs, falling back to heuristic.");
  } catch (err) {
    console.error("[llm] OpenAI error:", err);
  }

  // Fallback if anything goes wrong
  return heuristicPlaylist(mood, tracks);
}

/**
 * Simple local fallback: shuffle tracks and pick 3–6.
 */
function heuristicPlaylist(_mood: string, tracks: Track[]): number[] {
  if (tracks.length === 0) return [];

  const shuffled = [...tracks].sort(() => Math.random() - 0.5);
  const count = Math.min(6, Math.max(3, shuffled.length));
  return shuffled.slice(0, count).map((t) => t.id);
}
