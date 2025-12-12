export type CrossfadeEvt = {
  start: number; // seconds into current track when fade begins
  duration: number; // fade length in seconds
};

export type FilterSweepEvt = {
  channel: "A" | "B";
  from: number;
  to: number;
  duration: number; // seconds
};

export function fireNowPlaying(bpm: number | undefined, energy: number | undefined) {
  const safeBpm = typeof bpm === "number" && Number.isFinite(bpm) ? bpm : 120;
  const safeEnergy = Math.min(1, Math.max(0, typeof energy === "number" ? energy : 0.5));
  window.dispatchEvent(
    new CustomEvent("afrotech:nowplaying", { detail: { bpm: safeBpm, energy: safeEnergy } })
  );
}

export function fireCrossfade(e: CrossfadeEvt) {
  window.dispatchEvent(new CustomEvent("afrotech:dj:crossfade", { detail: e }));
}

export function fireFilterSweep(e: FilterSweepEvt) {
  window.dispatchEvent(new CustomEvent("afrotech:dj:filter", { detail: e }));
}




