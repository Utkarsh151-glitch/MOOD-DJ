// src/lib/topTracksCache.ts
export type TopTrack = {
  id: number;
  title: string;
  artist: string | null;
  fileUrl: string;
  timesUsed: number;
};

let cache: { data: TopTrack[]; expiresAt: number } | null = null;
const TTL_MS = 60_000; // 1 minute

export function getTopTracksFromCache(): TopTrack[] | null {
  if (!cache) return null;
  if (Date.now() > cache.expiresAt) {
    cache = null;
    return null;
  }
  return cache.data;
}

export function setTopTracksCache(data: TopTrack[]) {
  cache = {
    data,
    expiresAt: Date.now() + TTL_MS,
  };
}
