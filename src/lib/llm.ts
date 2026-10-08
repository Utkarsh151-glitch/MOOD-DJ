// src/lib/llm.ts
import OpenAI from "openai";

let client: OpenAI | null = null;

// Only construct the SDK client when a key exists; the constructor throws without one.
function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export interface AiPlaylistResult {
  selection: { trackId: number; order: number }[];
  usedAi: boolean;
}

// mood + list of tracks in, selection out
export async function getAiPlaylist(
  mood: string,
  tracks: { id: number; title: string; artist: string | null }[]
): Promise<AiPlaylistResult> {
  const FALLBACK_COUNT = Math.min(6, Math.max(3, tracks.length));

  // If no key configured -> pure heuristic
  const client = getClient();
  if (!client) {
    const selection = tracks.slice(0, FALLBACK_COUNT).map((t, idx) => ({
      trackId: t.id,
      order: idx,
    }));
    return { selection, usedAi: false };
  }

  try {
    const trackList = tracks
      .map((t) => `- ${t.id}: "${t.title}" by ${t.artist ?? "Unknown"}`)
      .join("\n");

    const prompt = `
You are a music DJ. User mood: "${mood}".

Available tracks:
${trackList}

Return ONLY a JSON array of objects, each having:
- "trackId" (number, from the list above)
- "order" (integer starting at 0 for first song in mix)

Example:
[
  { "trackId": 1, "order": 0 },
  { "trackId": 3, "order": 1 }
]
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    } as any);

    // Responses API: output_text joins the text parts; strip ```json fences if the model adds them.
    const text = String((response as any)?.output_text ?? "[]")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = [];
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Empty or invalid LLM result");
    }

    const selection = parsed
      .map((item: any) => ({
        trackId: Number(item.trackId),
        order: Number(item.order),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.trackId) && Number.isFinite(item.order)
      );

    if (selection.length === 0) {
      throw new Error("No valid playlist items after parsing");
    }

    return { selection, usedAi: true };
  } catch (err) {
    console.error("[llm] OpenAI error:", err);

    // Fallback: simple heuristic on local tracks
    const fallbackTracks = tracks.slice(0, FALLBACK_COUNT);
    const selection = fallbackTracks.map((t, idx) => ({
      trackId: t.id,
      order: idx,
    }));
    return { selection, usedAi: false };
  }
}
