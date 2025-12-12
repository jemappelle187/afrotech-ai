"use client";
import { useEffect, useRef, useState } from "react";
import { AIDJEngine, Source } from "@/lib/ai-dj/engine";
import { emitNowPlaying } from "@/lib/bus";

export default function AIDJ({ query = "afrobeat mix" }: { query?: string }) {
  const [status, setStatus] = useState("idle");
  const [now, setNow] = useState<Source | null>(null);
  const engineRef = useRef<AIDJEngine | null>(null);
  const queueRef = useRef<Source[]>([]);

  async function loadMore() {
    const r = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
    const j = await r.json();
    const items: Source[] = (j.items || []).map((x: any) => ({
      id: x.id, title: x.title, artists: x.artists || [], source: x.source,
      artwork: x.artwork || null, durationMs: x.durationMs || null
    }));
    queueRef.current.push(...items);
  }

  async function nextTrack() {
    if (queueRef.current.length === 0) await loadMore();
    const n = queueRef.current.shift();
    return n || null;
  }

  useEffect(() => {
    if (!engineRef.current) engineRef.current = new AIDJEngine();
    (async () => {
      setStatus("loading");
      const first = await nextTrack();
      if (!first) { setStatus("empty"); return; }
      setNow(first);
      // first load goes to deck B hot (so crossfade makes sense later)
      await engineRef.current!.crossfadeTo(first);
      setStatus("playing");
      // loop: schedule next track when we are ~15s from end (approx by duration)
      const dur = first.durationMs ?? 210000;
      const lead = 16000;
      setTimeout(async () => {
        const nxt = await nextTrack();
        if (!nxt) return;
        setNow(nxt);
        await engineRef.current!.crossfadeTo(nxt);
      }, Math.max(10000, dur - lead));
    })();
  }, [query]);

  return (
    <div className="pointer-events-none fixed top-3 left-3 text-xs text-white/80 space-y-1">
      <div className="text-white/60">AI DJ</div>
      <div className="font-medium">{now?.title || "—"}</div>
      <div className="text-white/60">{now?.artists?.join(", ")}</div>
      <div className="text-white/60">Src: {now?.source ?? "—"}</div>
    </div>
  );
}


