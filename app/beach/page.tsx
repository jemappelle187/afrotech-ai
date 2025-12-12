'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { MusicPlayer } from '@/components/MusicPlayer';
import { DrinkButton } from '@/components/DrinkButton';
import { AuthButton } from '@/components/AuthButton';
import { PlaylistSelector } from '@/components/PlaylistSelector';
import Link from 'next/link';

const Scene = dynamic(() => import('@/components/Scene'), { 
  ssr: false,
  loading: () => <div className="fixed inset-0 -z-10 bg-black" />
});

export default function BeachPage() {
  const [beat, setBeat] = useState(0);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('');

  return (
    <main className="min-h-screen relative">
      {/* 3D Scene background */}
      <div className="fixed inset-0 -z-10">
        <Scene beat={beat} environment="beach" />
      </div>

      {/* UI Overlay */}
      <div className="relative z-10 flex flex-col items-center p-6 gap-4" style={{ filter: 'brightness(0.85) contrast(1.02)' }}>
        <Link 
          href="/" 
          className="absolute top-6 left-6 text-sm text-white/60 hover:text-white transition-colors"
        >
          ← Back
        </Link>

        <div className="mt-16 space-y-6 flex flex-col items-center">
          <h2 className="text-white/70 uppercase tracking-widest text-sm">
            Beach Session <span className="text-xs opacity-50">(beta)</span>
          </h2>

          <MusicPlayer onBeat={setBeat} playlistUri={selectedPlaylist} />

          <div className="flex flex-wrap gap-3 justify-center items-center">
            <AuthButton />
            <PlaylistSelector onPlaylistSelect={setSelectedPlaylist} />
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <DrinkButton item="drink" />
            <DrinkButton item="wine" />
            <DrinkButton item="champagne" />
          </div>

          <p className="text-xs text-white/40 max-w-md text-center mt-4">
            Beach vibes with warm, tropical tones. Select a playlist and feel the rhythm! 🌊
          </p>
        </div>
      </div>
    </main>
  );
}

