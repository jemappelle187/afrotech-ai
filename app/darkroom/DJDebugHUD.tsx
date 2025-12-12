// app/darkroom/DJDebugHUD.tsx
"use client";

import * as React from "react";
import { getNowPlaying } from "@/lib/afroBus";

export default function DJDebugHUD() {
  const [show, setShow] = React.useState(false);
  const [bpm, setBpm] = React.useState<number | null>(null);
  const [energy, setEnergy] = React.useState<number | null>(null);
  const [camelot, setCamelot] = React.useState<string | null>(null);
  const [track, setTrack] = React.useState<string>("");
  const [beatOn, setBeatOn] = React.useState(false);

  // Decide visibility only on the client to avoid SSR mismatch
  React.useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      setShow(q.get("debug") === "1");
    } catch {}
  }, []);

  React.useEffect(() => {
    if (!show) return;

    // Seed from latest payload so HUD isn't blank until next event
    const seed = getNowPlaying();
    if (seed) {
      if (typeof seed.bpm === "number") setBpm(Math.round(seed.bpm));
      if (typeof seed.energy === "number")
        setEnergy(Math.round(seed.energy * 100) / 100);
      if (seed.camelot) setCamelot(seed.camelot);
      if (seed.name) setTrack(seed.name);
    }

    const onNP = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (typeof d?.bpm === "number") setBpm(Math.round(d.bpm));
      if (typeof d?.energy === "number")
        setEnergy(Math.round(d.energy * 100) / 100);
      if (d?.camelot) setCamelot(d.camelot);
      if (d?.name) setTrack(d.name);
    };

    const onBeat = () => {
      setBeatOn(true);
      window.setTimeout(() => setBeatOn(false), 60);
    };

    window.addEventListener("afrotech:nowplaying", onNP as EventListener);
    window.addEventListener("afrotech:beat", onBeat as EventListener);

    return () => {
      window.removeEventListener("afrotech:nowplaying", onNP as EventListener);
      window.removeEventListener("afrotech:beat", onBeat as EventListener);
    };
  }, [show]);

  if (!show) return null;

  const isStandby = !bpm && !energy;

  return (
    <div
      className="fixed top-4 left-4 z-30 rounded-xl border border-white/10 bg-black/60 backdrop-blur px-4 py-3 text-xs text-white/90 space-y-1"
      style={{ pointerEvents: "none" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-2.5 w-2.5 rounded-full transition-opacity"
          style={{ background: "#6ee7ff", opacity: beatOn ? 1 : 0.25 }}
          title="Beat LED"
        />
        <div className="truncate max-w-[44vw]">
          {track || "—"}
          {isStandby && (
            <span className="ml-2 opacity-50 text-[10px]">(standby)</span>
          )}
        </div>
      </div>
      <div className="opacity-80">
        BPM: <b>{bpm ?? "—"}</b> • Energy: <b>{energy ?? "—"}</b> • Key:{" "}
        <b>{camelot ?? "—"}</b>
      </div>
      <div className="opacity-60">Engine: bar-quantized, section-aware</div>
    </div>
  );
}

