// lib/afroBus.ts

export type NowPlayingPayload = {
  id?: string;
  name?: string;
  artists?: string[];
  bpm?: number | null;
  energy?: number | null;
  camelot?: string | null;
};

declare global {
  interface Window {
    __afro?: {
      nowplaying?: NowPlayingPayload;
      playing?: boolean;
    };
  }
}

export function setNowPlaying(p: NowPlayingPayload) {
  if (typeof window === "undefined") return;
  window.__afro = window.__afro || {};
  window.__afro.nowplaying = p;
  window.dispatchEvent(new CustomEvent("afrotech:nowplaying", { detail: p }));
  console.log("[BUS] nowplaying →", p);
}

export function setTransport(playing: boolean) {
  if (typeof window === "undefined") return;
  window.__afro = window.__afro || {};
  window.__afro.playing = playing;
  window.dispatchEvent(
    new CustomEvent("afrotech:transport", { detail: { playing } })
  );
  console.log("[BUS] transport →", playing ? "playing" : "paused");
}

export function getNowPlaying(): NowPlayingPayload | undefined {
  if (typeof window === "undefined") return undefined;
  return window.__afro?.nowplaying;
}

export function getPlaying(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.__afro?.playing;
}

