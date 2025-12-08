// src/lib/topTracksCache.ts

type TopTrack = {
  id: number;
  title: string;
  artist: string | null;
  fileUrl: string;
  uses: number;
};

let cached: TopTrack[] | null = null;
let expiresAt = 0;
const TTL_MS = 60_000; // 60 seconds

export function getTopTracksCache(): TopTrack[] | null {
  if (!cached || Date.now() > expiresAt) {
    return null;
  }
  return cached;
}

export function setTopTracksCache(data: TopTrack[]) {
  cached = data;
  expiresAt = Date.now() + TTL_MS;
}

export function clearTopTracksCache() {
  cached = null;
  expiresAt = 0;
}
