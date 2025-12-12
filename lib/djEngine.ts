export type TrackRef = {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  durationMs: number;
};

export type AudioFeatures = {
  id: string;
  tempo: number;
  key: number;
  mode: number;
  energy: number;
  danceability: number;
  loudness: number;
};

export type AudioAnalysis = {
  id: string;
  bars?: { start: number }[];
  sections?: { start: number; duration: number }[];
  beats?: { start: number }[];
};

export type EnrichedTrack = TrackRef & {
  features?: AudioFeatures;
  analysis?: AudioAnalysis;
  camelot?: string;
};

export type TransitionPlan = {
  atMs: number;
  fadeMs: number;
  startCueMs: number;
  targetGainFrom: number;
  targetGainTo: number;
  reason: string;
  next: EnrichedTrack;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function camelotKey(key: number, mode: number): string {
  const major = [
    "8B",
    "3B",
    "10B",
    "5B",
    "12B",
    "7B",
    "2B",
    "9B",
    "4B",
    "11B",
    "6B",
    "1B",
  ];
  const minor = [
    "5A",
    "12A",
    "7A",
    "2A",
    "9A",
    "4A",
    "11A",
    "6A",
    "1A",
    "8A",
    "3A",
    "10A",
  ];
  const arr = mode === 1 ? major : minor;
  return arr[(key + 12) % 12];
}

export function isHarmonic(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const n1 = parseInt(a, 10);
  const n2 = parseInt(b, 10);
  const l1 = a.slice(-1);
  const l2 = b.slice(-1);
  if (a === b) return true;
  const neighbors = l1 === l2 && (Math.abs(n1 - n2) === 1 || Math.abs(n1 - n2) === 11);
  const relative = l1 !== l2 && n1 === n2;
  return neighbors || relative;
}

export function quantizeToNextBar(
  nowMs: number,
  bars?: { start: number }[],
  playbackPositionMs?: number
): number {
  if (!bars || !bars.length || playbackPositionMs == null) return nowMs;
  const posS = playbackPositionMs / 1000;
  const next = bars.find((b) => b.start > posS);
  if (!next) return nowMs;
  const add = Math.max(0, (next.start - posS)) * 1000;
  return nowMs + add;
}

// ---- Section-aware helpers -----------------------------------------------

function synthesizeBarsFromTempo(
  tempo?: number | null,
  durationSec?: number
): { start: number }[] {
  const t = tempo && tempo > 0 ? tempo : 120;
  const barDur = (60 / t) * 4;
  const total = Math.max(durationSec ?? 180, 60);
  const bars: { start: number }[] = [];
  let s = 0;
  while (s < total) {
    bars.push({ start: s });
    s += barDur;
  }
  return bars;
}

function findIntroCueMs(next: EnrichedTrack): number {
  const sections = next.analysis?.sections ?? [];
  const intro = sections.find((s) => s.start > 10 && s.start < 30)?.start;
  if (intro != null) return Math.max(0, Math.floor(intro * 1000));

  const firstBar = next.analysis?.bars?.[0]?.start;
  if (firstBar != null) return Math.max(0, Math.floor(firstBar * 1000));

  const bpm = next.features?.tempo ?? 120;
  const twoBarsMs = Math.min(15000, Math.round(((60 / bpm) * 4) * 1000));
  return Math.max(0, twoBarsMs);
}

function findOutroWindowMs(current: EnrichedTrack): {
  startMs: number;
  minFadeMs: number;
} {
  const dur = current.durationMs ?? 0;
  const secs = current.analysis?.sections ?? [];
  const lastStartMs = secs.length
    ? Math.floor(secs[secs.length - 1].start * 1000)
    : dur - 24000;
  const startMs = Math.max(0, Math.min(Math.max(0, dur - 8000), lastStartMs));
  const headroom = Math.max(0, dur - startMs);
  const minFadeMs = headroom > 20000 ? 12000 : 8000;
  return { startMs, minFadeMs };
}

const fetchJSON = async (url: string, token: string) => {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`request failed ${res.status}`);
  return res.json();
};

export class DJEngine {
  private token: string;
  private playlist: EnrichedTrack[] = [];
  private features = new Map<string, AudioFeatures>();
  private analysis = new Map<string, AudioAnalysis>();

  constructor(opts: { token: string }) {
    this.token = opts.token;
  }

  setPlaylist(tracks: TrackRef[]) {
    this.playlist = tracks.map((t) => ({ ...t }));
  }

  async enrichTracks(): Promise<void> {
    const ids = this.playlist.map((t) => t.id);
    await this.fetchFeaturesBatch(ids);
    await this.fetchAnalysisLight(ids.slice(0, 50));

    this.playlist = this.playlist.map((t) => {
      const f = this.features.get(t.id);
      const a = this.analysis.get(t.id);
      return {
        ...t,
        features: f,
        analysis: a,
        camelot: f ? camelotKey(f.key, f.mode) : undefined,
      };
    });
  }

  getPlaylist(): EnrichedTrack[] {
    return this.playlist;
  }

  getAudioFeatures(id: string): AudioFeatures | undefined {
    return this.features.get(id);
  }

  getAudioAnalysis(id: string): AudioAnalysis | undefined {
    return this.analysis.get(id);
  }

  pickNextTrack(current: EnrichedTrack): EnrichedTrack | null {
    const f0 = current.features;
    const candidates = this.playlist.filter((t) => t.id !== current.id && t.features);
    if (!f0 || !candidates.length) return this.randomFallback(current.id);

    let best: EnrichedTrack | null = null;
    let bestScore = -Infinity;

    for (const t of candidates) {
      const f = t.features!;
      const keyScore = isHarmonic(current.camelot, t.camelot) ? 1 : -0.5;
      const bpmDelta = Math.abs((f.tempo || 120) - (f0.tempo || 120));
      const bpmScore = -Math.min(bpmDelta / 6, 2);
      const energyScore = -Math.abs((f.energy ?? 0.5) - (f0.energy ?? 0.5)) * 0.8;
      const dance = f.danceability ?? 0.5;
      const score = 1.2 * keyScore + 1.0 * bpmScore + 0.8 * energyScore + dance * 0.2;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }

    return best ?? this.randomFallback(current.id);
  }

  computeTransition(
    current: EnrichedTrack,
    next: EnrichedTrack,
    opts?: {
      fallbackFadeMs?: number;
      targetFadeMs?: number;
      getPlaybackPositionMs?: () => number | undefined;
    }
  ): TransitionPlan {
    const fallbackFadeMs = opts?.fallbackFadeMs ?? 9000;
    const targetFadeMs = opts?.targetFadeMs ?? 12000;

    const cueMs = findIntroCueMs(next);
    const { startMs: outroStart, minFadeMs } = findOutroWindowMs(current);

    const now = performance.now();
    const pos = opts?.getPlaybackPositionMs?.() ?? 0;

    const currentTempo = current.features?.tempo ?? 120;
    const bars =
      current.analysis?.bars?.length
        ? current.analysis.bars
        : synthesizeBarsFromTempo(currentTempo, (current.durationMs ?? 0) / 1000);

    const earliest = Math.max(now + 500, now + Math.max(0, outroStart - pos));
    const atMs = quantizeToNextBar(earliest, bars, pos);

    const energy = current.features?.energy ?? 0.5;
    const desired = lerp(targetFadeMs * 0.8, targetFadeMs * 1.2, clamp01(energy));
    const fadeMs = Math.max(minFadeMs, desired) || fallbackFadeMs;

    return {
      atMs,
      fadeMs,
      startCueMs: Math.max(0, cueMs),
      targetGainFrom: 0,
      targetGainTo: 1,
      reason: `harmonic=${isHarmonic(current.camelot, next.camelot)} bpm≈${Math.round(
        next.features?.tempo ?? 0
      )}`,
      next,
    };
  }

  scheduleTransition(
    plan: TransitionPlan,
    controls: {
      getPositionMs: () => number | undefined;
      setVolume: (v: number) => Promise<void>;
      getVolume: () => number | undefined;
      playTrack: (uri: string, cueMs?: number) => Promise<void>;
    }
  ): Promise<void> {
    return new Promise((resolve) => {
      const delay = Math.max(0, plan.atMs - performance.now());

      window.setTimeout(async () => {
        await controls.playTrack(plan.next.uri, plan.startCueMs);
        await controls.setVolume(0.0001);

        const doFilter = Math.random() < 0.7;
        if (doFilter) {
          const startSweepSec = Math.min(1.5, plan.fadeMs / 2000);
          window.dispatchEvent(
            new CustomEvent("afrotech:dj:filter", {
              detail: { duration: startSweepSec },
            })
          );
          window.setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("afrotech:dj:filter", { detail: { duration: 0.9 } })
            );
          }, plan.fadeMs * 0.5);
        }

        const steps = 30;
        const stepMs = plan.fadeMs / steps;
        let i = 0;
        const fadeTimer = window.setInterval(async () => {
          i++;
          const up = clamp01(i / steps);
          const v = lerp(0.0001, 1.0, up);
          await controls.setVolume(v);

          if (i >= steps) {
            window.clearInterval(fadeTimer);
            window.dispatchEvent(
              new CustomEvent("afrotech:dj:crossfade", {
                detail: { duration: plan.fadeMs / 1000 },
              })
            );
            resolve();
          }
        }, stepMs);
      }, delay);
    });
  }

  private async fetchFeaturesBatch(ids: string[]) {
    for (let i = 0; i < ids.length; i += 100) {
      const slice = ids.slice(i, i + 100);
      try {
        const json = await fetchJSON(
          `https://api.spotify.com/v1/audio-features?ids=${encodeURIComponent(
            slice.join(",")
          )}`,
          this.token
        );
        (json?.audio_features || []).forEach((f: any) => {
          if (!f || !f.id) return;
          const af: AudioFeatures = {
            id: f.id,
            tempo: f.tempo,
            key: f.key,
            mode: f.mode,
            energy: f.energy,
            danceability: f.danceability,
            loudness: f.loudness,
          };
          this.features.set(af.id, af);
        });
      } catch {}
    }
  }

  private async fetchAnalysisLight(ids: string[]) {
    for (const id of ids) {
      try {
        const json = await fetchJSON(
          `https://api.spotify.com/v1/audio-analysis/${id}`,
          this.token
        );
        const aa: AudioAnalysis = {
          id,
          bars: json?.bars?.map((b: any) => ({ start: b.start })) ?? [],
          sections:
            json?.sections?.map((s: any) => ({ start: s.start, duration: s.duration })) ?? [],
          beats: json?.beats?.map((b: any) => ({ start: b.start })) ?? [],
        };
        this.analysis.set(id, aa);
      } catch (err: any) {
        if (err?.message?.includes("403")) {
          console.warn(`[DJEngine] audio-analysis 403 for ${id} (region/catalog restriction)`);
        }
        // Continue without analysis; transitions will use synthetic bars
      }
    }
  }

  private randomFallback(excludeId: string): EnrichedTrack | null {
    const pool = this.playlist.filter((t) => t.id !== excludeId);
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}
