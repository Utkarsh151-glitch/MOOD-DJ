// src/lib/llm.ts
import OpenAI from "openai";
import type { Track } from "@prisma/client";

// Uses OPENAI_API_KEY from .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Main function used by /api/mix
 * Returns a list of track IDs in order + whether LLM was actually used.
 */
export async function getAiPlaylist(
  mood: string,
  tracks: Track[]
): Promise<{ trackIds: number[]; usedAi: boolean }> {
  // No key → use local heuristic
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[llm] OPENAI_API_KEY missing → using heuristic.");
    return {
      trackIds: buildHeuristicMix(mood, tracks),
      usedAi: false,
    };
  }

  if (!tracks.length) {
    return { trackIds: [], usedAi: false };
  }

  try {
    const trackList = tracks
      .map(
        (t) =>
          `${t.id}: ${t.title} by ${t.artist ?? "Unknown artist"}`
      )
      .join("\n");

    const systemPrompt = `
You are a music assistant. The user gives you a mood and a list of available tracks.
You must select up to 10 track IDs that best match the mood.
Return ONLY a JSON array of IDs, e.g.: [1, 5, 7].
No explanations, no extra text.
`.trim();

    const userPrompt = `
User mood: "${mood}"

Available tracks (id: title by artist):
${trackList}

Pick up to 10 track IDs that best fit this mood.
Return ONLY a JSON array of numbers like: [1, 2, 3].
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      console.warn("[llm] OpenAI returned empty content → heuristic.");
      return {
        trackIds: buildHeuristicMix(mood, tracks),
        usedAi: false,
      };
    }

    // Try to extract JSON array from the text
    let jsonText = raw.trim();
    const bracketMatch = jsonText.match(/\[[\s\S]*\]/);
    if (bracketMatch) jsonText = bracketMatch[0];

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      console.warn("[llm] JSON parse error:", e, "raw:", raw);
      return {
        trackIds: buildHeuristicMix(mood, tracks),
        usedAi: false,
      };
    }

    let ids: number[] = [];

    if (Array.isArray(parsed)) {
      ids = parsed.map((v) => Number(v)).filter((v) => !Number.isNaN(v));
    } else if (
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray((parsed as any).track_ids)
    ) {
      ids = (parsed as any).track_ids
        .map((v: any) => Number(v))
        .filter((v: number) => !Number.isNaN(v));
    } else {
      console.warn("[llm] JSON shape invalid:", parsed);
      return {
        trackIds: buildHeuristicMix(mood, tracks),
        usedAi: false,
      };
    }

    // Keep only valid DB IDs
    const validIds = ids.filter((id) =>
      tracks.some((t) => t.id === id)
    );

    if (!validIds.length) {
      console.warn("[llm] No valid IDs from LLM → heuristic.");
      return {
        trackIds: buildHeuristicMix(mood, tracks),
        usedAi: false,
      };
    }

    console.log("[llm] OpenAI selected track IDs:", validIds);
    return { trackIds: validIds, usedAi: true };
  } catch (err) {
    console.error("[llm] OpenAI error:", err);
    return {
      trackIds: buildHeuristicMix(mood, tracks),
      usedAi: false,
    };
  }
}

/**
 * Simple fallback if LLM fails or has no key.
 */
export function buildHeuristicMix(mood: string, tracks: Track[]): number[] {
  const moodLower = mood.toLowerCase();

  const scored = tracks.map((t) => {
    const text = `${t.title} ${t.artist ?? ""}`.toLowerCase();
    let score = 0;

    if (moodLower.includes("romantic")) {
      if (
        text.includes("love") ||
        text.includes("dil") ||
        text.includes("heart")
      )
        score += 3;
    }

    if (moodLower.includes("sad")) {
      if (text.includes("sad") || text.includes("cry")) score += 3;
    }

    if (moodLower.includes("happy") || moodLower.includes("party")) {
      if (text.includes("party") || text.includes("dance")) score += 3;
    }

    if (text.includes(moodLower)) score += 2;

    return {
      id: t.id,
      score,
      uploadedAt: t.uploadedAt as any as Date,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (
      new Date(b.uploadedAt).getTime() -
      new Date(a.uploadedAt).getTime()
    );
  });

  return scored.slice(0, 10).map((s) => s.id);
}
