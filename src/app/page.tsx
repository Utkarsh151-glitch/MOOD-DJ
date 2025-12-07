"use client";

import { useEffect, useState, FormEvent } from "react";

type Track = {
  id: number;
  title: string;
  artist?: string | null;
  fileUrl: string;
  playCount?: number | null;
};

type TopTrack = {
  id: number;
  title: string;
  artist?: string | null;
  totalSelections: number;
};

export default function HomePage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
  const [mixTracks, setMixTracks] = useState<Track[]>([]);

  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isLoadingTop, setIsLoadingTop] = useState(false);
  const [isGeneratingMix, setIsGeneratingMix] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadArtist, setUploadArtist] = useState("");

  const [mood, setMood] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ------------ helpers to call backend ------------

  const fetchTracks = async () => {
    try {
      setIsLoadingTracks(true);
      const res = await fetch("/api/tracks");
      if (!res.ok) throw new Error("Failed to load tracks");
      const data: Track[] = await res.json();
      setTracks(data);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to load tracks");
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const fetchTopTracks = async () => {
    try {
      setIsLoadingTop(true);
      const res = await fetch("/api/stats/top-tracks");
      if (!res.ok) throw new Error("Failed to load stats");
      const body = await res.json();
      // Expecting shape: { source: "db" | "cache", data: TopTrack[] }
      const data: TopTrack[] = body.data ?? [];
      setTopTracks(data);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to load top tracks");
    } finally {
      setIsLoadingTop(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchTracks();
    fetchTopTracks();
  }, []);

  // ------------ upload logic ------------

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!uploadFile) {
      setErrorMessage("Please choose an MP3/WAV file to upload.");
      return;
    }

    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append("file", uploadFile);
      if (uploadTitle.trim()) formData.append("title", uploadTitle.trim());
      if (uploadArtist.trim()) formData.append("artist", uploadArtist.trim());

      const res = await fetch("/api/tracks", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.text();
        console.error("Upload failed:", body);
        throw new Error("Upload failed");
      }

      const created: Track = await res.json();
      setTracks((prev) => [created, ...prev]);
      setUploadFile(null);
      setUploadTitle("");
      setUploadArtist("");
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to upload track.");
    } finally {
      setIsUploading(false);
    }
  };

  // ------------ delete track ------------

  const handleDeleteTrack = async (id: number) => {
    try {
      const res = await fetch(`/api/tracks/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        console.error("Delete failed:", await res.text());
        return;
      }

      setTracks((prev) => prev.filter((t) => t.id !== id));
      setMixTracks((prev) => prev.filter((t) => t.id !== id));
      // refresh top tracks after delete
      fetchTopTracks();
    } catch (err) {
      console.error("Delete error", err);
    }
  };

  // ------------ generate mix ------------

  const handleGenerateMix = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!mood.trim()) {
      setErrorMessage("Please enter a mood prompt first.");
      return;
    }

    if (tracks.length === 0) {
      setErrorMessage("Upload some tracks before generating a mix.");
      return;
    }

    try {
      setIsGeneratingMix(true);
      const res = await fetch("/api/mix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: mood.trim() }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error("Mix error:", body);
        setErrorMessage("Failed to generate mix.");
        return;
      }

      const data = await res.json();
      // Expect shape: { tracks: Track[], ... }
      const selected: Track[] = data.tracks ?? [];
      setMixTracks(selected);

      // Refresh top tracks, since counts may have changed
      fetchTopTracks();
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to generate mix.");
    } finally {
      setIsGeneratingMix(false);
    }
  };

  // ------------ UI ------------

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-10">
        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Mood DJ
          </h1>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Upload your music, describe your mood, and let the backend
            DJ build a mix. All tracks and stats are stored in a real
            database so recruiters can inspect the API.
          </p>
        </header>

        {errorMessage && (
          <div className="rounded-md border border-red-500/70 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {errorMessage}
          </div>
        )}

        {/* Layout: left = upload & tracks, right = mood + mix + stats */}
        <div className="grid gap-8 lg:grid-cols-[2fr,1.4fr]">
          {/* LEFT COLUMN */}
          <section className="space-y-6">
            {/* Upload card */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
              <h2 className="text-lg font-semibold">Upload track</h2>
              <form
                onSubmit={handleUpload}
                className="space-y-3 text-sm"
              >
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400">
                    Audio file (mp3 / wav)
                  </label>
                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/wav"
                    onChange={(e) =>
                      setUploadFile(
                        e.target.files?.[0] ?? null
                      )
                    }
                    className="block w-full text-xs text-zinc-200
                      file:mr-3 file:rounded-md file:border-0
                      file:bg-zinc-800 file:px-3 file:py-1.5
                      file:text-xs file:font-medium
                      hover:file:bg-zinc-700"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block text-xs text-zinc-400">
                      Title (optional)
                    </label>
                    <input
                      value={uploadTitle}
                      onChange={(e) =>
                        setUploadTitle(e.target.value)
                      }
                      placeholder="e.g. Lo-fi Study Beat"
                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-zinc-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-zinc-400">
                      Artist (optional)
                    </label>
                    <input
                      value={uploadArtist}
                      onChange={(e) =>
                        setUploadArtist(e.target.value)
                      }
                      placeholder="Artist name"
                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-zinc-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-1.5 text-xs font-medium text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUploading ? "Uploading..." : "Upload track"}
                </button>
              </form>
            </div>

            {/* Track list */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Your tracks
                </h2>
                {isLoadingTracks && (
                  <span className="text-xs text-zinc-400">
                    Loading...
                  </span>
                )}
              </div>

              {tracks.length === 0 && !isLoadingTracks && (
                <p className="text-xs text-zinc-400">
                  No tracks yet. Upload a song to get started.
                </p>
              )}

              {tracks.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  {tracks.map((track) => (
                    <div
                      key={track.id}
                      className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {track.title || "Untitled track"}
                          </p>
                          {track.artist && (
                            <p className="text-xs text-zinc-400 truncate">
                              {track.artist}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteTrack(track.id)
                          }
                          className="text-[11px] px-2 py-1 rounded-md border border-red-500/70 text-red-300 hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>

                      <audio
                        controls
                        src={track.fileUrl}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* RIGHT COLUMN */}
          <section className="space-y-6">
            {/* Mood / Mix generator */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
              <h2 className="text-lg font-semibold">
                Generate mood-based mix
              </h2>

              <form
                onSubmit={handleGenerateMix}
                className="space-y-3 text-sm"
              >
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400">
                    Mood prompt
                  </label>
                  <input
                    value={mood}
                    onChange={(e) =>
                      setMood(e.target.value)
                    }
                    placeholder='e.g. "calm focus", "romantic evening", "gym hype"'
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-zinc-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isGeneratingMix}
                  className="inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-1.5 text-xs font-medium text-black hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGeneratingMix
                    ? "Generating mix..."
                    : "Generate mix"}
                </button>
              </form>

              {/* Mix result */}
              {mixTracks.length > 0 && (
                <div className="mt-3 border-t border-zinc-800 pt-3 space-y-2">
                  <h3 className="text-sm font-semibold">
                    Current mix
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Ordered playlist generated from your mood +
                    available tracks.
                  </p>

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {mixTracks.map((track, idx) => (
                      <div
                        key={track.id}
                        className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] text-zinc-500 w-4">
                              {idx + 1}.
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">
                                {track.title || "Untitled track"}
                              </p>
                              {track.artist && (
                                <p className="text-[11px] text-zinc-400 truncate">
                                  {track.artist}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <audio
                          controls
                          src={track.fileUrl}
                          className="mt-1 w-full"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top tracks */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Top tracks
                </h2>
                {isLoadingTop && (
                  <span className="text-xs text-zinc-400">
                    Refreshing...
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-400">
                Based on how many times each track is selected in AI
                mixes (using DB aggregation + caching).
              </p>

              {topTracks.length === 0 && !isLoadingTop && (
                <p className="text-xs text-zinc-500">
                  No stats yet. Generate a few mixes to see the
                  most-used tracks.
                </p>
              )}

              {topTracks.length > 0 && (
                <ul className="space-y-2 text-xs">
                  {topTracks.map((t, idx) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-4 text-[11px] text-zinc-500">
                          {idx + 1}.
                        </span>
                        <div className="min-w-0">
                          <p className="truncate">
                            {t.title || "Untitled track"}
                          </p>
                          {t.artist && (
                            <p className="text-[11px] text-zinc-400 truncate">
                              {t.artist}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-emerald-300">
                        {t.totalSelections}× in mixes
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* Footer note for reviewers */}
        <footer className="pt-4 border-t border-zinc-900 text-[11px] text-zinc-500">
          <p>
            Backend: Next.js API routes + Prisma + PostgreSQL +
            caching. Frontend: simple React player UI. All endpoints
            are public so you can inspect the data model.
          </p>
        </footer>
      </div>
    </main>
  );
}
