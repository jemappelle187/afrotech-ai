"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  DJEngine,
  camelotKey,
  isHarmonic,
  type AudioAnalysis,
  type EnrichedTrack,
  type TrackRef,
} from "@/lib/djEngine";
import { fireNowPlaying } from "@/lib/djAvatarBridge";
import { setNowPlaying, setTransport } from "@/lib/afroBus";
import { getFreshSpotifyToken } from "@/lib/spotifyToken";

// Reuse a single player across HMR/rerenders
declare global {
  interface Window {
    __afroPlayer?: any | null;
    __afroDeviceId?: string | null;
  }
}

function emitAfrotechNowPlaying(d: {
  id?: string | null;
  name?: string;
  artists?: string[];
  bpm?: number | null;
  energy?: number | null;
  camelot?: string | null;
}) {
  try {
    window.dispatchEvent(
      new CustomEvent("afrotech:nowplaying", {
        detail: {
          id: d.id ?? null,
          name: d.name ?? "",
          artists: d.artists ?? [],
          bpm: typeof d.bpm === "number" ? Math.round(d.bpm) : null,
          energy:
            typeof d.energy === "number"
              ? Math.round(d.energy * 100) / 100
              : null,
          camelot: d.camelot ?? null,
        },
      })
    );
  } catch {}
}

type LegacyAudioFeatures = {
  id: string;
  tempo?: number;
  key?: number;
  mode?: number;
  energy?: number;
};

type TrackMeta = {
  id: string;
  uri: string;
  name: string;
  artists?: string[];
  duration_ms?: number;
};

type SpotifyState = {
  paused: boolean;
  position?: number;
  duration?: number;
  track_window?: {
    current_track?: { id?: string; name?: string; uri?: string };
  };
};

type TrackAnalysis = {
  tempo: number;
  timeSignature: number;
  key: number | null;
  beats: { start: number }[];
  bars: { start: number; duration?: number }[];
  sections?: {
    start: number;
    duration: number;
    loudness?: number;
    confidence?: number;
  }[];
  duration: number;
};

// ---- SAFE FALLBACKS FOR WHEN SPOTIFY ANALYSIS IS MISSING ----
type SimpleBar = { start: number; duration?: number };

const analysis403Cache = new Set<string>();

function synthesizeBarsFromTempo(
  tempo?: number | null,
  durationMs?: number
): SimpleBar[] {
  const tempoVal = tempo && tempo > 0 ? tempo : 120;
  const barDur = (60 / tempoVal) * 4; // 4/4
  const total = Math.max((durationMs ?? 0) / 1000, 60); // at least 60s
  const out: SimpleBar[] = [];
  let s = 0;
  while (s < total) {
    out.push({ start: s, duration: barDur });
    s += barDur;
  }
  return out;
}

function getSafeBars(opts: {
  analysis?: { bars?: { start: number }[] } | null;
  tempo?: number | null;
  durationMs?: number;
}): SimpleBar[] {
  const bars = opts.analysis?.bars;
  if (Array.isArray(bars) && bars.length) {
    const tempoVal = Math.max(60, Math.min(200, opts.tempo ?? 120));
    const barDur = (60 / tempoVal) * 4;
    return bars.map((b, i, arr) => ({
      start: b.start,
      duration: i < arr.length - 1 ? arr[i + 1].start - b.start : barDur,
    }));
  }
  return synthesizeBarsFromTempo(opts.tempo, opts.durationMs);
}

async function fetchAudioAnalysisSafe(
  trackId: string
): Promise<TrackAnalysis | null> {
  if (analysis403Cache.has(trackId)) return null;

  // Coalesce concurrent requests
  const inflight = analysisInFlight.get(trackId);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const res = await fetch(
        `/api/spotify/audio-analysis?id=${encodeURIComponent(trackId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        if (res.status === 403) {
          if (!analysis403Cache.has(trackId)) {
            console.warn("[DJ] audio-analysis 403 cached for", trackId);
          }
          analysis403Cache.add(trackId);
        }
        return null;
      }
      const data = await res.json();
      const beats = (data.beats || []).map((b: any) => ({ start: b.start }));
      const bars = (data.bars || []).map((b: any) => ({
        start: b.start,
        duration: b.duration,
      }));
      const sections = (data.sections || []).map((s: any) => ({
        start: s.start,
        duration: s.duration,
        loudness: s.loudness,
        confidence: s.confidence,
      }));
      const tempo = data.track?.tempo ?? 120;
      const ts = data.track?.time_signature ?? 4;
      const duration =
        data.track?.duration ??
        (data.track?.duration_ms ? data.track.duration_ms / 1000 : 0);
      const key = Number.isFinite(data.track?.key) ? data.track.key : null;
      return { tempo, timeSignature: ts, key, beats, bars, sections, duration };
    } catch (e) {
      console.warn("[DJ] analysis fetch failed", e);
      return null;
    } finally {
      analysisInFlight.delete(trackId);
    }
  })();

  analysisInFlight.set(trackId, p);
  return p;
}

// --- Robust feature fetching with consistent user token ---
async function fetchWithToken(url: string): Promise<Response> {
  const { token } = await getFreshSpotifyToken();
  if (!token) throw new Error("No Spotify token");
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

const feature403Cache = new Set<string>();
// De-duplicate concurrent fetches and reduce spammy retries
const featureInFlight = new Map<string, Promise<any>>();
const analysisInFlight = new Map<string, Promise<TrackAnalysis | null>>();

async function fetchAudioFeaturesSafe(id: string) {
  if (!id || feature403Cache.has(id)) return null;

  // Coalesce concurrent requests
  const inflight = featureInFlight.get(id);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const r = await fetch(
        `/api/spotify/audio-features?id=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );
      if (r.ok) return await r.json();
      const body = await r.text().catch(() => "");
      if (r.status === 401) {
        console.warn("[DJ] audio-features 401 (unauthorized). Body:", body);
        return null;
      }
      if (r.status === 403) {
        if (!feature403Cache.has(id)) {
          console.warn("[DJ] audio-features 403 for", id);
        }
        feature403Cache.add(id);
        return null;
      }
      console.warn("[DJ] audio-features unexpected", r.status, body);
      return null;
    } catch (e) {
      console.warn("[DJ] audio-features fetch error", e);
      return null;
    } finally {
      featureInFlight.delete(id);
    }
  })();

  featureInFlight.set(id, p);
  return p;
}

function isHarmonicPair(
  current?: LegacyAudioFeatures,
  next?: LegacyAudioFeatures
): boolean {
  if (
    !current ||
    !next ||
    current.key == null ||
    next.key == null ||
    current.mode == null ||
    next.mode == null
  )
    return false;
  const camelotA = camelotKey(current.key, current.mode);
  const camelotB = camelotKey(next.key, next.mode);
  return isHarmonic(camelotA, camelotB);
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

async function transferPlaybackToDevice(deviceId: string, token: string) {
  try {
    const res = await fetch("https://api.spotify.com/v1/me/player", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_ids: [deviceId], play: false }),
    });
    if (res.status === 403) {
      const errorText = await res.text();
      console.error(
        "[Spotify] 403 on transfer: Web Playback requires Premium and 'streaming' scope",
        errorText
      );
      // Show user-friendly error
      if (typeof window !== 'undefined') {
        alert("Spotify Web Playback requires a Premium account. Please upgrade your Spotify account to use this feature.");
      }
    } else if (!res.ok) {
      console.warn(
        "[Spotify] transferPlayback non-ok",
        res.status,
        await res.text()
      );
    }
  } catch (err) {
    console.warn("[Spotify] transferPlayback error", err);
  }
}

export function MusicPlayer({
  onBeat,
  playlistUri,
  onStart,
}: {
  onBeat: (v: number) => void;
  playlistUri?: string;
  onStart?: () => void;
}) {
  const { data: session } = useSession();
  const [player, setPlayer] = useState<any>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackName, setTrackName] = useState<string>("");
  const [userPlaylists, setUserPlaylists] = useState<
    Array<{ name: string; uri: string; image?: string; owner?: string }>
  >([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedPlaylistUri, setSelectedPlaylistUri] = useState<
    string | undefined
  >(playlistUri);
  // Fetch user playlists when access token is available
  useEffect(() => {
    const token = (session as any)?.spotify?.accessToken;
    let aborted = false;
    async function loadPlaylists() {
      if (!token) return;
      try {
        let next:
          | string
          | null = `https://api.spotify.com/v1/me/playlists?limit=50`;
        const rows: Array<{
          name: string;
          uri: string;
          image?: string;
          owner?: string;
        }> = [];
        while (next && !aborted) {
          const r: Response = await fetch(next, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!r.ok) break;
          const j: any = await r.json();
          (j.items || []).forEach((pl: any) => {
            if (pl?.name && pl?.uri)
              rows.push({
                name: pl.name as string,
                uri: pl.uri as string,
                image:
                  Array.isArray(pl.images) && pl.images[0]
                    ? pl.images[0].url
                    : undefined,
                owner: pl?.owner?.display_name as string | undefined,
              });
          });
          next = j.next;
        }
        if (!aborted) setUserPlaylists(rows);
      } catch (e) {
        console.warn("Failed to load playlists", e);
      }
    }
    loadPlaylists();
    return () => {
      aborted = true;
    };
  }, [(session as any)?.spotify?.accessToken]);
  const rafRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const stateRef = useRef<SpotifyState | null>(null);
  const startWallClockRef = useRef<number>(0); // wall clock aligned to track position
  const analysisCacheRef = useRef<Map<string, TrackAnalysis>>(new Map());
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const lastProgressSentRef = useRef<number>(0);

  // --- DJ Engine State ---
  const [tracks, setTracks] = useState<TrackMeta[]>([]);
  const [features, setFeatures] = useState<Record<string, LegacyAudioFeatures>>(
    {}
  );
  const [analysis, setAnalysis] = useState<Record<string, AudioAnalysis>>({});
  const [currentTrack, setCurrentTrack] = useState<TrackMeta | undefined>(
    undefined
  );
  const featuresRef = useRef<Record<string, LegacyAudioFeatures>>({});
  const analysisRef = useRef<Record<string, AudioAnalysis>>({});
  const djRef = useRef<DJEngine | null>(null);
  const currentTrackRef = useRef<EnrichedTrack | null>(null);
  const currentVolumeRef = useRef<number>(1);
  const nextPlanRef = useRef<boolean>(false);
  const playRequestedRef = useRef(false);
  const playingRef = useRef(false);
  const analysisForbidden = useRef<Set<string>>(new Set());
  const deviceIdRef = useRef<string | null>(null);

  async function getAccessToken(): Promise<string | null> {
    try {
      const { token } = await getFreshSpotifyToken();
      return token;
    } catch (err) {
      console.warn("getAccessToken failed, falling back", err);
      return (
        (window as any).__SPOTIFY_TOKEN ||
        localStorage.getItem("spotify_access_token") ||
        null
      );
    }
  }

  useEffect(() => {
    let aborted = false;
    setTracks([]);
    setFeatures({});
    setAnalysis({});
    (async () => {
      if (!playlistUri) return;
      const token = await getAccessToken();
      if (!token) return;

      const idMatch =
        playlistUri.match(/playlist[:/](.*?)(\?|$)/) ||
        playlistUri.match(/playlist[:](.*)$/);
      const playlistId = idMatch ? idMatch[1] : playlistUri;

      const items: TrackMeta[] = [];
      let next:
        | string
        | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

      while (next && !aborted) {
        const res: Response = await fetch(next, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) break;
        const json: any = await res.json();
        for (const it of json.items || []) {
          const t = it.track;
          if (!t || !t.id || !t.uri) continue;
          items.push({
            id: t.id,
            uri: t.uri,
            name: t.name,
            artists: (t.artists || []).map((a: any) => a.name),
            duration_ms: t.duration_ms,
          });
        }
        next = json.next;
      }

      if (!aborted) {
        setTracks(items);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [playlistUri]);

  useEffect(() => {
    const token = (session as any)?.spotify?.accessToken as string | undefined;
    if (!token || tracks.length === 0) return;

    let cancelled = false;

    (async () => {
      const baseTracks: TrackRef[] = tracks.map((t) => ({
        id: t.id,
        uri: t.uri,
        name: t.name,
        artists: t.artists ?? [],
        durationMs: t.duration_ms ?? 0,
      }));

      const engine = djRef.current ?? new DJEngine({ token });
      engine.setPlaylist(baseTracks);
      djRef.current = engine;

      try {
        await engine.enrichTracks();
        if (cancelled) return;
        const enriched = engine.getPlaylist();
        const feat: Record<string, LegacyAudioFeatures> = {};
        const ana: Record<string, AudioAnalysis> = {};
        enriched.forEach((t) => {
          if (t.features) {
            feat[t.id] = {
              id: t.id,
              tempo: t.features.tempo,
              key: t.features.key,
              mode: t.features.mode,
              energy: t.features.energy,
            };
          }
          if (t.analysis) {
            ana[t.id] = t.analysis;
          }
        });
        setFeatures((prev) => ({ ...prev, ...feat }));
        setAnalysis((prev) => ({ ...prev, ...ana }));
      } catch (err) {
        console.warn("DJEngine enrichTracks failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tracks, (session as any)?.spotify?.accessToken]);

  useEffect(() => {
    featuresRef.current = features;
  }, [features]);

  useEffect(() => {
    analysisRef.current = analysis;
  }, [analysis]);

  useEffect(() => {
    let aborted = false;
    (async () => {
      if (djRef.current) return;
      const token = await getAccessToken();
      if (!token || tracks.length === 0) return;

      // FEATURES (via server route, per id to avoid CORS/403)
      const byId: Record<string, LegacyAudioFeatures> = {};
      const ids = tracks.map((t) => t.id);
      for (const fid of ids) {
        try {
          const res = await fetch(
            `/api/spotify/audio-features?id=${encodeURIComponent(fid)}`,
            { cache: "no-store" }
          );
          if (!res.ok) continue;
          const f = await res.json();
          if (!f || !f.id) continue;
          byId[f.id] = {
            id: f.id,
            tempo: f.tempo,
            key: f.key,
            mode: f.mode,
            energy: f.energy,
          };
        } catch {}
      }
      if (aborted) return;
      setFeatures(byId);

      // ANALYSIS (subset initially) via server route
      const firstIds = ids.slice(0, Math.min(12, ids.length));
      const analysisById: Record<string, AudioAnalysis> = {};
      for (const id of firstIds) {
        try {
          const r = await fetch(
            `/api/spotify/audio-analysis?id=${encodeURIComponent(id)}`,
            { cache: "no-store" }
          );
          if (!r.ok) continue;
          const j = await r.json();
          analysisById[id] = {
            id,
            bars: j?.bars?.map((b: any) => ({
              start: b.start,
              duration: b.duration,
            })),
            sections: j?.sections?.map((s: any) => ({
              start: s.start,
              duration: s.duration,
              loudness: s.loudness,
              confidence: s.confidence,
            })),
          };
        } catch {}
        if (aborted) return;
      }
      setAnalysis((prev) => ({ ...prev, ...analysisById }));
    })();

    return () => {
      aborted = true;
    };
  }, [tracks]);

  useEffect(() => {
    function onNow(e: Event) {
      const detail = (e as CustomEvent).detail as any;
      if (!detail) return;
      const trackId: string | undefined = detail.trackId;
      const found = tracks.find((tr) => tr.id === trackId);
      if (found) {
        setCurrentTrack(found);
      } else if (tracks.length && !currentTrack) {
        setCurrentTrack(tracks[0]);
      }
    }

    window.addEventListener("nowplaying", onNow as EventListener);
    return () => {
      window.removeEventListener("nowplaying", onNow as EventListener);
    };
  }, [tracks, currentTrack]);

  useEffect(() => {
    if (!currentTrack) return;
    const feat = featuresRef.current[currentTrack.id];
    if (feat) {
      fireNowPlaying(feat.tempo, feat.energy);
    } else {
      fireNowPlaying(undefined, undefined);
    }
  }, [currentTrack, features]);

  useEffect(() => {
    // Only try Spotify playback if user is logged in
    const spotifyToken = (session as any)?.spotify?.accessToken;

    if (!spotifyToken) {
      // Fallback to local MP3 playback
      initLocalPlayback();
      return;
    }

    (window as any).__SPOTIFY_TOKEN = spotifyToken;

    // Initialize Spotify Web Playback SDK
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    (window as any).onSpotifyWebPlaybackSDKReady = () => {
      // Reuse singleton if exists
      if (window.__afroPlayer) {
        setPlayer(window.__afroPlayer);
        if (window.__afroDeviceId) setDeviceId(window.__afroDeviceId);
        return;
      }

      const spotifyPlayer = new (window as any).Spotify.Player({
        name: "Afrotech Darkroom",
        getOAuthToken: async (cb: any) => {
          try {
            const { token } = await getFreshSpotifyToken();
            cb(token);
          } catch (err) {
            console.warn("getOAuthToken failed", err);
            cb("");
          }
        },
        volume: 0.8,
      });

      (window as any).spotifyPlayer = spotifyPlayer;
      window.__afroPlayer = spotifyPlayer;

      // Set up event handlers
      spotifyPlayer.addListener("ready", async ({ device_id }: any) => {
        console.log("[SDK] ready", device_id);
        window.__afroDeviceId = device_id;
        deviceIdRef.current = device_id;
        setDeviceId(device_id);
        setPlayer(spotifyPlayer);

        // Transfer playback to this device
        try {
          const { token } = await getFreshSpotifyToken();
          await transferPlaybackToDevice(device_id, token);
        } catch (err) {
          console.warn("transferPlaybackToDevice failed", err);
        }
      });

      spotifyPlayer.addListener("not_ready", ({ device_id }: any) => {
        console.warn("[SDK] not_ready", device_id);
        if (deviceIdRef.current === device_id) {
          deviceIdRef.current = null;
        }
      });

      spotifyPlayer.addListener(
        "player_state_changed",
        async (state: SpotifyState) => {
          if (!state) return;

          stateRef.current = state;
          const isPlaying = !state.paused;

          // Only emit transport/nowplaying when state actually changes
          if (playingRef.current !== isPlaying) {
            playingRef.current = isPlaying;
            setIsPlaying(isPlaying);
            setTransport(isPlaying);

            // When playback starts and we have a current track, emit nowplaying
            if (isPlaying && currentTrackRef.current) {
              const t = currentTrackRef.current;
              const feat = t.features;
              const camelot =
                feat?.key != null && feat?.mode != null
                  ? camelotKey(feat.key, feat.mode)
                  : null;
              setNowPlaying({
                id: t.id,
                name: t.name,
                artists: t.artists ?? [],
                bpm: feat?.tempo ?? 120,
                energy: feat?.energy ?? 0.6,
                camelot,
              });
              emitAfrotechNowPlaying({
                id: t.id,
                name: t.name,
                artists: t.artists ?? [],
                bpm: feat?.tempo ?? 120,
                energy: feat?.energy ?? 0.6,
                camelot,
              });
            }
          }

          const name = state.track_window?.current_track?.name || "";
          const id = state.track_window?.current_track?.id || null;
          setTrackName(name);
          setCurrentTrackId(id);

          // Dispatch Now Playing event for UI
          const track: any = (state as any).track_window?.current_track || {};
          const artist = Array.isArray(track.artists)
            ? track.artists.map((a: any) => a.name).join(", ")
            : "";
          const image = track?.album?.images?.[0]?.url || "";
          const durationSec =
            typeof (state as any).duration === "number"
              ? (state as any).duration / 1000
              : analysisCacheRef.current.get(id || "")?.duration || 0;
          const positionSec =
            typeof (state as any).position === "number"
              ? (state as any).position / 1000
              : 0;

          window.dispatchEvent(
            new CustomEvent("nowplaying", {
              detail: {
                title: name,
                artist,
                image,
                duration: durationSec,
                position: positionSec,
                isPlaying: !state.paused,
                trackId: id,
              },
            })
          );
          // --- Always emit HUD metrics with safe fallbacks ---
          const cachedFeat = id ? featuresRef.current[id] : undefined;
          const cachedAna = id ? analysisCacheRef.current.get(id) : undefined;

          const bpmVal = (cachedAna?.tempo ?? cachedFeat?.tempo ?? 120) | 0; // integer BPM
          const energyVal =
            typeof cachedFeat?.energy === "number" ? cachedFeat.energy : 0.6;
          const camelotVal =
            cachedFeat?.key != null && cachedFeat?.mode != null
              ? camelotKey(cachedFeat.key, cachedFeat.mode)
              : null;

          // Keep AfroBus in sync so UI/HUD don't display "standby"
          setNowPlaying({
            id: id ?? undefined,
            name,
            artists: artist
              ? artist.split(",").map((s: string) => s.trim())
              : [],
            bpm: bpmVal,
            energy: energyVal,
            camelot: camelotVal,
          });

          emitAfrotechNowPlaying({
            id,
            name,
            artists: artist
              ? artist.split(",").map((s: string) => s.trim())
              : [],
            bpm: bpmVal,
            energy: energyVal,
            camelot: camelotVal,
          });

          // If we don't yet have real features for this track, fetch them in the background
          (async () => {
            if (!id || cachedFeat) return;
            const f = await fetchAudioFeaturesSafe(id);
            if (!f) return;

            setFeatures((prev) => ({
              ...prev,
              [id]: {
                id,
                tempo: f.tempo,
                key: f.key,
                mode: f.mode,
                energy: f.energy,
              },
            }));

            const newCamelot =
              f.key != null && f.mode != null
                ? camelotKey(f.key, f.mode)
                : null;

            setNowPlaying({
              id,
              name,
              artists: artist
                ? artist.split(",").map((s: string) => s.trim())
                : [],
              bpm: f.tempo ?? bpmVal,
              energy: f.energy ?? energyVal,
              camelot: newCamelot,
            });

            emitAfrotechNowPlaying({
              id,
              name,
              artists: artist
                ? artist.split(",").map((s: string) => s.trim())
                : [],
              bpm: f.tempo ?? bpmVal,
              energy: f.energy ?? energyVal,
              camelot: newCamelot,
            });
          })();

          // align wall clock to current playback position for beat timing
          const pos = (state as any).position ?? 0;
          startWallClockRef.current = Date.now() - pos;

          // fetch audio analysis for current track (once, cached)
          if (
            id &&
            !analysisCacheRef.current.has(id) &&
            !analysisForbidden.current.has(id)
          ) {
            // Never refetch after a 403 was seen, even if state races
            if (analysisForbidden.current.has(id)) return;
            try {
              const analysis = await fetchAudioAnalysisSafe(id);
              if (analysis) {
                analysisCacheRef.current.set(id, analysis);
                setAnalysis((prev) => ({
                  ...prev,
                  [id]: {
                    id,
                    bars: analysis.bars?.map((b) => ({
                      start: b.start,
                      duration: b.duration ?? 0,
                    })),
                    sections: analysis.sections?.map((s) => ({
                      start: s.start,
                      duration: s.duration,
                      loudness: s.loudness,
                      confidence: s.confidence,
                    })),
                  },
                }));
              }
            } catch (e) {
              console.warn("Audio analysis fetch failed", e);
            }
          } else if (id) {
            const cached = analysisCacheRef.current.get(id);
            // Only populate analysis state if we don't already have it
            if (!analysis[id]) {
              if (cached) {
                // Use cached analysis safely
                setAnalysis((prev) => ({
                  ...prev,
                  [id]: {
                    id,
                    bars: (cached.bars ?? []).map((b) => ({
                      start: b.start,
                      duration: b.duration ?? 0,
                    })),
                    sections: (cached.sections ?? []).map((s) => ({
                      start: s.start,
                      duration: s.duration,
                      loudness: s.loudness,
                      confidence: s.confidence,
                    })),
                  },
                }));
              } else {
                // No cached analysis yet — synthesize a basic bar grid so downstream code never crashes
                const feat = featuresRef.current?.[id];
                const tempoForBars = feat?.tempo ?? 120;
                // Try to find the track to get duration for better bar synthesis
                const maybeTrack =
                  tracks.find((t) => t.id === id) ||
                  (currentTrackRef.current
                    ? { duration_ms: currentTrackRef.current.durationMs }
                    : undefined);

                const safeBars = getSafeBars({
                  analysis: undefined,
                  tempo: tempoForBars,
                  durationMs: maybeTrack?.duration_ms ?? 0,
                });

                setAnalysis((prev) => ({
                  ...prev,
                  [id]: {
                    id,
                    bars: safeBars.map((b) => ({
                      start: b.start,
                      duration: b.duration ?? 0,
                    })),
                    sections: [],
                  },
                }));
              }
            }
          }

          // start beat timing (using analysis if available, else fallback)
          startBeatTick();
        }
      );

      spotifyPlayer.connect().catch((err: any) => {
        console.warn(
          "player.connect error (may be harmless SDK internal)",
          err
        );
      });
    };

    return () => {
      try {
        if (player && typeof player.disconnect === "function") {
          player.disconnect();
        }
      } catch (err) {
        console.warn("player cleanup error", err);
      }
      cancelAnimationFrame(rafRef.current);
    };
  }, [session]);

  // DJEngine handles transition scheduling; legacy picker removed.

  const initLocalPlayback = () => {
    // Local playback removed - Spotify-only mode
    console.log("Local playback skipped (Spotify required)");
    return;
    const audio = new Audio("/sample-mix.mp3");
    audio.loop = true;

    const AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) {
      console.warn("Web Audio API not supported");
      return;
    }

    const ctx = new AudioContext();
    const src = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    const data = new Uint8Array(analyser.frequencyBinCount);

    src.connect(analyser);
    analyser.connect(ctx.destination);
    analyserRef.current = analyser;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      // Focus on bass and low-mid frequencies for better beat detection
      const bass = data.slice(0, 5).reduce((a, b) => a + b, 0) / (5 * 255);
      const lowMid = data.slice(5, 15).reduce((a, b) => a + b, 0) / (10 * 255);
      // Combine and amplify for more visible reaction
      const combined = (bass * 0.7 + lowMid * 0.3) * 1.5;
      onBeat(Math.min(1, combined));
      rafRef.current = requestAnimationFrame(tick);
    };

    audio.play().catch(() => {
      console.log("Audio autoplay blocked - click anywhere to start");
    });

    tick();

    const handleClick = () => {
      if (audio.paused) {
        audio.play().catch(console.error);
        if (ctx.state === "suspended") {
          ctx.resume();
        }
      }
    };
    document.addEventListener("click", handleClick, { once: true });
  };

  const setupSpotifyAnalysis = () => {
    const AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyserRef.current = analyser;

    // Note: Direct audio analysis from Spotify SDK requires additional setup
    // For now, we'll use a simulated beat based on Spotify's audio features
    const tick = () => {
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(data);
        const bass = data.slice(0, 10).reduce((a, b) => a + b, 0) / (10 * 255);
        onBeat(bass);
      } else {
        // Simulate beat when no analyser (approximate 120 BPM) - more pronounced
        const now = Date.now();
        const beat = Math.sin((now / 500) * Math.PI) * 0.5 + 0.5;
        onBeat(beat * 0.8);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    tick();
  };

  // --- Spotify helpers ---

  async function fetchAudioAnalysis(
    trackId: string
  ): Promise<TrackAnalysis | null> {
    if (analysisForbidden.current.has(trackId)) return null;
    try {
      const res = await fetch(
        `/api/spotify/audio-analysis?id=${encodeURIComponent(trackId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        if (res.status === 403) {
          analysisForbidden.current.add(trackId);
          console.warn(`[DJ] audio-analysis 403 cached for ${trackId}`);
        }
        throw new Error(`audio-analysis failed: ${res.status}`);
      }
      const data = await res.json();
      const beats = (data.beats || []).map((b: any) => ({ start: b.start }));
      const bars = (data.bars || []).map((b: any) => ({
        start: b.start,
        duration: b.duration,
      }));
      const sections = (data.sections || []).map((s: any) => ({
        start: s.start,
        duration: s.duration,
        loudness: s.loudness,
        confidence: s.confidence,
      }));
      const tempo = data.track?.tempo ?? 120;
      const ts = data.track?.time_signature ?? 4;
      const duration =
        data.track?.duration ??
        (data.track?.duration_ms ? data.track.duration_ms / 1000 : 0);
      const key = Number.isFinite(data.track?.key) ? data.track.key : null;
      return { tempo, timeSignature: ts, key, beats, bars, sections, duration };
    } catch (err: any) {
      if (String(err?.message || "").includes("403")) {
        analysisForbidden.current.add(trackId);
        console.warn(`[DJ] audio-analysis 403 cached for ${trackId}`);
      }
      return null;
    }
  }

  function startBeatTick() {
    cancelAnimationFrame(rafRef.current);
    const token = (session as any)?.spotify?.accessToken;
    const tick = () => {
      const id = currentTrackId;
      const analysis = id ? analysisCacheRef.current.get(id) : undefined;

      // compute current position based on wall clock (always)
      const nowMs = Date.now();
      const posMs = nowMs - startWallClockRef.current;
      const posSec = Math.max(0, posMs / 1000);
      const durationSec =
        (analysis?.duration ??
          ((stateRef.current as any)?.duration
            ? (stateRef.current as any).duration / 1000
            : 0)) ||
        0;

      if (analysis) {
        // Find distance to nearest beat and turn it into a pulse 0..1
        const idx = binarySearchByStart(analysis.beats, posSec);
        const nearest =
          analysis.beats[Math.max(0, Math.min(analysis.beats.length - 1, idx))];
        const dt = Math.abs((nearest?.start ?? posSec) - posSec);
        const sigma = Math.max(0.03, 0.12 - (analysis.tempo - 90) * 0.0005);
        const beatPulse = Math.exp(-(dt * dt) / (2 * sigma * sigma));
        onBeat(Math.min(1, beatPulse * 1.2));
        try {
          window.dispatchEvent(
            new CustomEvent("afrotech:beat", {
              detail: { v: Math.min(1, beatPulse * 1.2) },
            })
          );
        } catch {}
      } else {
        // fallback to simple sinusoid ~120 BPM
        const beat = Math.sin((nowMs / 500) * Math.PI) * 0.5 + 0.5;
        onBeat(beat * 0.8);
        try {
          window.dispatchEvent(
            new CustomEvent("afrotech:beat", { detail: { v: beat * 0.8 } })
          );
        } catch {}
      }

      // Throttle UI progress events to ~8 Hz
      if (nowMs - lastProgressSentRef.current > 120) {
        lastProgressSentRef.current = nowMs;
        window.dispatchEvent(
          new CustomEvent("playprogress", {
            detail: {
              position: posSec,
              duration: durationSec,
              isPlaying: !stateRef.current?.paused,
            },
          })
        );
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }

  // returns the index of the closest item with start >= t
  function binarySearchByStart(arr: { start: number }[], t: number) {
    let lo = 0,
      hi = arr.length - 1,
      mid;
    while (lo <= hi) {
      mid = (lo + hi) >> 1;
      if (arr[mid].start < t) lo = mid + 1;
      else hi = mid - 1;
    }
    // lo is first index with start >= t
    if (lo <= 0) return 0;
    if (lo >= arr.length) return arr.length - 1;
    // choose nearer between lo and lo-1
    return t - arr[lo - 1].start < arr[lo].start - t ? lo - 1 : lo;
  }

  // --- Local fallback playback ---

  async function apiPlayUris(uris: string[], position_ms = 0) {
    const id = deviceIdRef.current;
    if (!id) throw new Error("No device id available");

    const res = await fetch(
      `/api/spotify/play?device_id=${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uris,
          position_ms: Math.max(0, position_ms | 0),
        }),
      }
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[apiPlayUris] failed", res.status, txt);
      throw new Error(`play failed: ${res.status}`);
    }
  }

  const controls = useMemo(
    () => ({
      getPositionMs: () => stateRef.current?.position ?? undefined,
      getVolume: () => currentVolumeRef.current,
      setVolume: async (v: number) => {
        const clamped = Math.min(1, Math.max(0, v));
        currentVolumeRef.current = clamped;
        if (player && typeof player.setVolume === "function") {
          try {
            await player.setVolume(clamped);
          } catch (err) {
            console.warn("setVolume failed", err);
          }
        }
      },
      playTrack: async (uri: string, cueMs = 0) => {
        const base = tracks.find((t) => t.uri === uri);
        if (!base) return;

        const engine = djRef.current;
        const cachedFeature = engine?.getAudioFeatures(base.id);
        const cachedAnalysis = engine?.getAudioAnalysis(base.id);

        // Start playback first
        await apiPlayUris([uri], cueMs);
        nextPlanRef.current = false;

        // Only emit nowplaying if user has requested playback
        if (playRequestedRef.current) {
          const camelotStr =
            cachedFeature?.key != null && cachedFeature?.mode != null
              ? camelotKey(cachedFeature.key, cachedFeature.mode)
              : null;
          const bpmFallback = cachedFeature?.tempo ?? 120;
          const energyFallback = cachedFeature?.energy ?? 0.6;

          setNowPlaying({
            id: base.id,
            name: base.name,
            artists: base.artists ?? [],
            bpm: bpmFallback,
            energy: energyFallback,
            camelot: camelotStr ?? null,
          });
          emitAfrotechNowPlaying({
            id: base.id,
            name: base.name,
            artists: base.artists ?? [],
            bpm: bpmFallback,
            energy: energyFallback,
            camelot: camelotStr ?? null,
          });
          setTransport(true);
        }

        // 3) Update internal state
        const enriched =
          engine?.getPlaylist().find((t) => t.uri === uri) ?? null;
        const feature = enriched?.features || cachedFeature;
        const analysisData = enriched?.analysis || cachedAnalysis;

        currentTrackRef.current = enriched ?? {
          id: base.id,
          uri: base.uri,
          name: base.name,
          artists: base.artists ?? [],
          durationMs: base.duration_ms ?? 0,
          features: feature ?? undefined,
          analysis: analysisData ?? undefined,
          camelot: feature ? camelotKey(feature.key, feature.mode) : undefined,
        };

        setCurrentTrack(base);
        setCurrentTrackId(base.id);

        // Update local features cache
        if (feature) {
          setFeatures((prev) => ({
            ...prev,
            [base.id]: {
              id: base.id,
              tempo: feature.tempo,
              key: feature.key,
              mode: feature.mode,
              energy: feature.energy,
            },
          }));
          fireNowPlaying(feature.tempo, feature.energy);
        } else {
          fireNowPlaying(undefined, undefined);
        }

        // Async: fetch and update with real features if not cached
        if (playRequestedRef.current && !feature) {
          (async () => {
            const f = await fetchAudioFeaturesSafe(base.id);
            if (!f) return;
            const realCamelot = camelotKey(f.key, f.mode);
            setNowPlaying({
              id: base.id,
              name: base.name,
              artists: base.artists ?? [],
              bpm: f.tempo ?? 120,
              energy: f.energy ?? 0.6,
              camelot: realCamelot,
            });
            emitAfrotechNowPlaying({
              id: base.id,
              name: base.name,
              artists: base.artists ?? [],
              bpm: f.tempo ?? 120,
              energy: f.energy ?? 0.6,
              camelot: realCamelot,
            });
          })();
        }

        if (analysisData) {
          setAnalysis((prev) => ({ ...prev, [base.id]: analysisData }));

          const beats = (analysisData.beats ?? []).map((b) => ({
            start: b.start,
          }));
          const bars = getSafeBars({
            analysis: analysisData ?? undefined,
            tempo: feature?.tempo ?? 120,
            durationMs: base.duration_ms ?? 0,
          });
          const sections =
            analysisData.sections?.map((s) => ({
              start: s.start,
              duration: s.duration,
              loudness: undefined,
              confidence: undefined,
            })) ?? [];

          analysisCacheRef.current.set(base.id, {
            tempo: feature?.tempo ?? 120,
            timeSignature: 4,
            key: feature?.key ?? null,
            beats,
            bars,
            sections,
            duration: (base.duration_ms ?? 0) / 1000,
          });
          return;
        }
        // Fallback path: no analysis available yet – synthesize bars and fetch features/analysis in background
        (async () => {
          try {
            // Ensure features are loaded so HUD can update from 120/0.6 to real values
            if (!feature) {
              const f = await fetchAudioFeaturesSafe(base.id);
              if (f) {
                const realCamelot = camelotKey(f.key, f.mode);
                setFeatures((prev) => ({
                  ...prev,
                  [base.id]: {
                    id: base.id,
                    tempo: f.tempo,
                    key: f.key,
                    mode: f.mode,
                    energy: f.energy,
                  },
                }));
                setNowPlaying({
                  id: base.id,
                  name: base.name,
                  artists: base.artists ?? [],
                  bpm: f.tempo ?? 120,
                  energy: f.energy ?? 0.6,
                  camelot: realCamelot,
                });
                emitAfrotechNowPlaying({
                  id: base.id,
                  name: base.name,
                  artists: base.artists ?? [],
                  bpm: f.tempo ?? 120,
                  energy: f.energy ?? 0.6,
                  camelot: realCamelot,
                });
              }
            }

            // Attempt to fetch full analysis, but guard against 403s
            const freshAnalysis = await fetchAudioAnalysisSafe(base.id);

            // Build a safe bar timeline either from analysis or synthesized from tempo
            const tempoForBars = feature?.tempo ?? freshAnalysis?.tempo ?? 120;

            const safeBars = getSafeBars({
              analysis: freshAnalysis ?? undefined,
              tempo: tempoForBars,
              durationMs: base.duration_ms ?? 0,
            });

            const beats =
              freshAnalysis?.beats ??
              // derive a simple beat grid from bars if needed
              safeBars.map((b) => ({ start: b.start }));

            const sections =
              freshAnalysis?.sections?.map((s) => ({
                start: s.start,
                duration: s.duration,
                loudness: s.loudness,
                confidence: s.confidence,
              })) ?? [];

            // Populate caches so beat clock and transitions can run immediately
            analysisCacheRef.current.set(base.id, {
              tempo: tempoForBars,
              timeSignature: 4,
              key: feature?.key ?? freshAnalysis?.key ?? null,
              beats,
              bars: safeBars,
              sections,
              duration: (base.duration_ms ?? 0) / 1000,
            });

            setAnalysis((prev) => ({
              ...prev,
              [base.id]: {
                id: base.id,
                bars: safeBars.map((b) => ({
                  start: b.start,
                  duration: b.duration ?? 0,
                })),
                sections,
              },
            }));
          } catch (e) {
            console.warn("[DJ] fallback synth failed", e);
          }
        })();
      },
    }),
    [player, tracks]
  );

  const startFirst = async () => {
    if (!djRef.current || tracks.length === 0) return;

    // Ensure device is ready and transferred
    if (!deviceIdRef.current) throw new Error("Device not ready");

    try {
      await fetch("/api/spotify/transfer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_ids: [deviceIdRef.current],
          play: false,
        }),
      });
    } catch (err) {
      console.warn("Pre-play transfer failed", err);
    }

    const first = tracks[0];
    await controls.playTrack(first.uri, 0);
    await controls.setVolume(1);
  };

  useEffect(() => {
    if (!player || !djRef.current || tracks.length === 0) return;
    let mounted = true;
    let rafId = 0;

    const loop = () => {
      const state = stateRef.current;
      const current = currentTrackRef.current;
      if (state && current && current.durationMs) {
        const position = state.position ?? 0;
        const remaining = current.durationMs - position;
        if (remaining < 25000 && !nextPlanRef.current) {
          const engine = djRef.current;
          if (engine) {
            const next = engine.pickNextTrack(current);
            if (next) {
              const plan = engine.computeTransition(current, next, {
                getPlaybackPositionMs: () => state.position ?? 0,
              });
              console.log("[DJ] plan", {
                atMs: plan.atMs,
                fadeMs: plan.fadeMs,
                startCueMs: plan.startCueMs,
                reason: plan.reason,
                next: plan.next?.name,
              });
              nextPlanRef.current = true;
              engine.scheduleTransition(plan, controls).finally(() => {
                nextPlanRef.current = false;
                currentTrackRef.current = plan.next;
              });
            }
          }
        }
      }
      if (mounted) {
        rafId = requestAnimationFrame(loop);
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
    };
  }, [player, tracks, controls]);

  const startPlayback = async (customPlaylistUri?: string) => {
    if (!deviceId || !session) {
      console.warn("[Playback] Cannot start: deviceId=", deviceId, "session=", !!session);
      alert("Spotify player not ready. Please wait for 'Spotify Ready' status or click 'Connect Player'.");
      return;
    }

    playRequestedRef.current = true;
    onStart?.();

    if (djRef.current && tracks.length) {
      try {
        await startFirst();
      } catch (error) {
        console.error("DJEngine startFirst failed", error);
      }
      return;
    }

    const token = (session as any)?.spotify?.accessToken;
    const targetUri = customPlaylistUri || playlistUri;

    // The DJ engine now loads tracks, so this is no longer needed here.

    try {
      // If a specific playlist is selected, play that
      if (targetUri) {
        const playResponse = await fetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              context_uri: targetUri,
            }),
          }
        );
        
        if (!playResponse.ok) {
          const errorText = await playResponse.text();
          console.error("[Playback] Spotify API error:", playResponse.status, errorText);
          alert(`Failed to start playback: ${playResponse.status}. Check console for details.`);
        } else {
          console.log("[Playback] Successfully started playlist:", targetUri);
        }
        return;
      }

      // Otherwise, try recently played tracks
      const recentRes = await fetch(
        "https://api.spotify.com/v1/me/player/recently-played?limit=50",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (recentRes.ok) {
        const recentData = await recentRes.json();
        const trackUris =
          recentData.items?.map((item: any) => item.track.uri) || [];

        if (trackUris.length > 0) {
          await fetch(
            `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                uris: trackUris,
              }),
            }
          );
          return;
        }
      }

      // Fallback to saved tracks
      const savedRes = await fetch(
        "https://api.spotify.com/v1/me/tracks?limit=50",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (savedRes.ok) {
        const savedData = await savedRes.json();
        const trackUris =
          savedData.items?.map((item: any) => item.track.uri) || [];

        if (trackUris.length > 0) {
          await fetch(
            `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                uris: trackUris,
              }),
            }
          );
          return;
        }
      }

      // Last fallback: Search for Afrobeats playlist
      const searchRes = await fetch(
        "https://api.spotify.com/v1/search?q=afrobeats&type=playlist&limit=1",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const fallbackUri = searchData.playlists?.items?.[0]?.uri;

        if (fallbackUri) {
          await fetch(
            `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                context_uri: fallbackUri,
              }),
            }
          );
        }
      }
    } catch (error) {
      console.error("Failed to start playback:", error);
    }
  };

  // Auto-play selected playlist when it changes
  useEffect(() => {
    if (
      (selectedPlaylistUri || playlistUri) &&
      deviceId &&
      player &&
      tracks.length
    ) {
      startPlayback(selectedPlaylistUri || playlistUri);
    }
  }, [playlistUri, selectedPlaylistUri, deviceId, player, tracks.length]);

  const togglePlayback = () => {
    if (player) {
      player.togglePlay();
    }
  };

  // --- Disconnect Player ---
  const disconnectPlayer = () => {
    try {
      // Stop animation loop
      cancelAnimationFrame(rafRef.current);

      // Tell UI/scene we're no longer playing
      setIsPlaying(false);
      setTransport(false);

      // Clear current track UI
      setTrackName("");
      setCurrentTrackId(null as any);

      // Disconnect SDK player if present
      if (player && typeof player.disconnect === "function") {
        try {
          player.disconnect();
        } catch (err) {
          console.warn("player.disconnect threw", err);
        }
      }

      // Clear singletons and device refs
      try {
        (window as any).__afroPlayer = null;
        (window as any).spotifyPlayer = null;
        (window as any).__afroDeviceId = null;
      } catch {}

      deviceIdRef.current = null;
      setDeviceId("");

      // Optional: clear cached analysis timing so beat clock stops cleanly
      startWallClockRef.current = 0;

      console.log("[SDK] disconnected");
    } catch (err) {
      console.warn("disconnectPlayer failed", err);
    }
  };

  // --- Reconnect Player ---
  const reconnectPlayer = async () => {
    try {
      // If we already have a player/device cached, just reuse it.
      if ((window as any).__afroPlayer) {
        setPlayer((window as any).__afroPlayer);
        if ((window as any).__afroDeviceId) {
          deviceIdRef.current = (window as any).__afroDeviceId;
          setDeviceId((window as any).__afroDeviceId);
        }
        return;
      }

      const bootstrap = () => {
        // Prefer the initializer we registered in the effect.
        if (
          typeof (window as any).onSpotifyWebPlaybackSDKReady === "function"
        ) {
          (window as any).onSpotifyWebPlaybackSDKReady();
          return;
        }

        // Minimal inline bootstrap if the global callback isn't present.
        if ((window as any).Spotify?.Player) {
          const spotifyPlayer = new (window as any).Spotify.Player({
            name: "Afrotech Darkroom",
            getOAuthToken: async (cb: any) => {
              try {
                const { token } = await getFreshSpotifyToken();
                cb(token);
              } catch {
                cb("");
              }
            },
            volume: 0.8,
          });

          (window as any).spotifyPlayer = spotifyPlayer;
          (window as any).__afroPlayer = spotifyPlayer;

          spotifyPlayer.addListener("ready", async ({ device_id }: any) => {
            console.log("[SDK] ready (reconnect)", device_id);
            (window as any).__afroDeviceId = device_id;
            deviceIdRef.current = device_id;
            setDeviceId(device_id);
            setPlayer(spotifyPlayer);
            try {
              const { token } = await getFreshSpotifyToken();
              await transferPlaybackToDevice(device_id, token);
            } catch (err) {
              console.warn("transferPlaybackToDevice (reconnect) failed", err);
            }
          });

          spotifyPlayer.addListener("not_ready", ({ device_id }: any) => {
            console.warn("[SDK] not_ready (reconnect)", device_id);
            if (deviceIdRef.current === device_id) deviceIdRef.current = null;
          });

          spotifyPlayer.addListener(
            "player_state_changed",
            (state: SpotifyState) => {
              if (!state) return;
              stateRef.current = state;
              const playing = !state.paused;
              if (playingRef.current !== playing) {
                playingRef.current = playing;
                setIsPlaying(playing);
                setTransport(playing);
              }
              const id = state.track_window?.current_track?.id || null;
              const name = state.track_window?.current_track?.name || "";
              setTrackName(name);
              setCurrentTrackId(id);
              startWallClockRef.current = Date.now() - (state.position ?? 0);
              startBeatTick();
            }
          );

          spotifyPlayer.connect().catch((err: any) => {
            console.warn("player.connect (reconnect) error", err);
          });
          return;
        }

        // If the SDK isn't loaded yet, inject the script and rely on the global callback.
        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        script.onload = () => {
          (window as any).onSpotifyWebPlaybackSDKReady?.();
        };
        document.body.appendChild(script);
      };

      bootstrap();
    } catch (e) {
      console.warn("reconnectPlayer failed", e);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2 text-white/80">
      {/* State 1: No Spotify session yet */}
      {!(session as any)?.spotify?.accessToken && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => signIn("spotify")}
            className="text-xs border border-white/30 px-3 py-1 rounded hover:bg-white/10 transition-colors"
          >
            Connect Spotify
          </button>
          <span className="text-[10px] text-white/50">
            or enjoy the sample mix
          </span>
        </div>
      )}

      {/* State 2: Session present but player not ready */}
      {(session as any)?.spotify?.accessToken && !deviceId && (
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={reconnectPlayer}
            className="text-xs border border-white/30 px-3 py-1 rounded hover:bg-white/10 transition-colors"
          >
            Connect Player
          </button>
          <span className="text-[10px] text-white/50 text-right max-w-[200px]">
            Note: Spotify Web Playback requires a Premium account. If you have Premium, click "Connect Player" and allow access when prompted.
          </span>
        </div>
      )}

      {/* State 3: Player ready */}
      {(session as any)?.spotify?.accessToken && deviceId && (
        <div className="flex flex-col items-end gap-2">
          <div className="text-xs text-white/60">
            {trackName ? `Now Playing: ${trackName}` : "Spotify Ready"}
            {currentTrackId &&
            analysisCacheRef.current.get(currentTrackId)?.tempo
              ? ` • ${Math.round(
                  analysisCacheRef.current.get(currentTrackId)!.tempo
                )} BPM`
              : ""}
          </div>
          {/* Playlist selector UI */}
          {userPlaylists.length > 0 && (
            <div className="relative z-[60]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPickerOpen((s) => !s)}
                  className="text-xs border border-white/30 px-3 py-1 rounded hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {(() => {
                    const current = userPlaylists.find(
                      (p) => p.uri === selectedPlaylistUri
                    );
                    return current ? current.name : "Select playlist…";
                  })()}
                </button>
                <button
                  onClick={async () => {
                    if (!selectedPlaylistUri) return;
                    await startPlayback(selectedPlaylistUri);
                    setIsPickerOpen(false);
                  }}
                  disabled={!selectedPlaylistUri}
                  className="text-xs border border-white/30 px-3 py-1 rounded hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ▶ Play Selected
                </button>
              </div>

              {isPickerOpen && (
                <div className="absolute right-0 mt-2 w-[520px] max-w-[80vw] max-h-[60vh] overflow-auto rounded-xl border border-white/15 bg-black/70 backdrop-blur-md shadow-2xl">
                  <div className="sticky top-0 z-10 bg-black/60 backdrop-blur-md p-2 border-b border-white/10">
                    <input
                      autoFocus
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      placeholder="Search your playlists…"
                      className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-xs outline-none focus:border-white/40"
                    />
                  </div>

                  <ul className="divide-y divide-white/5">
                    {userPlaylists
                      .filter((pl) => {
                        const q = filterQuery.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          pl.name.toLowerCase().includes(q) ||
                          (pl.owner?.toLowerCase()?.includes(q) ?? false)
                        );
                      })
                      .map((pl) => (
                        <li key={pl.uri}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPlaylistUri(pl.uri);
                              setIsPickerOpen(false);
                              setFilterQuery("");
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-3"
                          >
                            {pl.image ? (
                              <img
                                src={pl.image}
                                alt=""
                                className="h-8 w-8 rounded object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded bg-white/10" />
                            )}
                            <div className="min-w-0">
                              <div className="truncate text-sm">{pl.name}</div>
                              {pl.owner && (
                                <div className="truncate text-[10px] text-white/50">
                                  by {pl.owner}
                                </div>
                              )}
                            </div>
                            {selectedPlaylistUri === pl.uri && (
                              <span className="ml-auto text-xs text-emerald-400">
                                selected
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            {!isPlaying && !trackName && (
              <button
                onClick={() => startPlayback()}
                className="text-xs border border-white/30 px-3 py-1 rounded hover:bg-white/10 transition-colors"
              >
                ▶ Start Music
              </button>
            )}
            {trackName && (
              <button
                onClick={togglePlayback}
                className="text-xs border border-white/30 px-3 py-1 rounded hover:bg-white/10 transition-colors"
              >
                {isPlaying ? "⏸ Pause" : "▶ Play"}
              </button>
            )}
            {/* New: allow the user to fully disconnect the Web Playback SDK device */}
            {deviceId && (
              <button
                onClick={disconnectPlayer}
                className="text-xs border border-red-400/50 text-red-200 px-3 py-1 rounded hover:bg-red-400/10 transition-colors"
                title="Disconnect this browser from Spotify Web Playback"
              >
                ⏏︎ Disconnect
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
