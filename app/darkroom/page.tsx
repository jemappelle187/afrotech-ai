"use client";

import dynamic from "next/dynamic";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FeedbackOverlay from "@/components/FeedbackOverlay";
import { MusicPlayer } from "@/components/MusicPlayer";

const HoodieDJ = dynamic(
  () => import("@/components/3d/HoodieDJ").then((mod) => mod.HoodieDJ),
  { ssr: false }
);

const DJDebugHUD = dynamic(() => import("./DJDebugHUD"), { ssr: false });
const AIDJ = dynamic(() => import("@/components/AIDJ"), { ssr: false });

function DarkRoomContent() {
  const [, setBeat] = useState(0);
  const searchParams = useSearchParams();
  const q = searchParams?.get("q") || "afrobeats";
  const aiDJEnabled = process.env.NEXT_PUBLIC_AI_DJ_ENABLED === "1";

  return (
    <main className="relative min-h-[100dvh] overflow-hidden text-white">
      {/* 3D scene layer */}
      <div className="absolute inset-0 z-0">
        <HoodieDJ />
      </div>

      {/* DJ Debug HUD */}
      <DJDebugHUD />

      {/* AI DJ (when enabled) */}
      {aiDJEnabled && <AIDJ query={q} />}

      {/* Spotify Player (restores connect button) */}
      <div className="absolute top-4 right-4 z-20">
        <MusicPlayer onBeat={setBeat} />
      </div>

      {/* Feedback UI */}
      <div className="absolute bottom-4 right-4 z-20">
        <FeedbackOverlay />
      </div>
    </main>
  );
}

export default function DarkRoomPage() {
  return (
    <Suspense fallback={<div className="relative min-h-[100dvh] overflow-hidden text-white" />}>
      <DarkRoomContent />
    </Suspense>
  );
}
