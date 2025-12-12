// Simple typed event bus for browser
export type NowPlaying = {
  id?: string;
  title?: string;
  artists?: string[];
  source: "soundcloud" | "youtube";
  bpm?: number | null;
  energy?: number | null;
  key?: string | null;
  durationMs?: number | null;
  positionMs?: number | null;
  artwork?: string | null;
};

export function emitNowPlaying(np: NowPlaying) {
  window.dispatchEvent(
    new CustomEvent("afrotech:nowplaying", { detail: np })
  );
}

export function emitBeat(v: number) {
  window.dispatchEvent(new CustomEvent("afrotech:beat", { detail: { v } }));
}

export function onNowPlaying(cb: (np: NowPlaying) => void) {
  const h = (e: Event) => cb((e as CustomEvent).detail);
  window.addEventListener("afrotech:nowplaying", h as EventListener);
  return () =>
    window.removeEventListener("afrotech:nowplaying", h as EventListener);
}

export function onBeat(cb: (v: number) => void) {
  const h = (e: Event) => cb((e as CustomEvent).detail?.v ?? 0);
  window.addEventListener("afrotech:beat", h as EventListener);
  return () => window.removeEventListener("afrotech:beat", h as EventListener);
}


