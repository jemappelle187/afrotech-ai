'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

interface VibeData {
  bpm: number;
  energy: number;
  dance: number;
  valence: number;
}

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  uri: string;
}

export function SpotifyVibe() {
  const { data: session } = useSession();
  const [vibe, setVibe] = useState<VibeData | null>(null);
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const getVibeAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      // Try alternative vibe endpoint (uses top tracks instead of audio features)
      const res = await fetch('/api/spotify/vibe-alt');
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to analyze');
      }
      
      const data = await res.json();
      
      if (data.vibe) {
        setVibe(data.vibe);
        setRecommendations(data.recommendations || []);
      } else {
        setError('No listening history found. Play some music and try again!');
      }
    } catch (err: any) {
      console.error('Failed to get vibe analysis:', err);
      setError(err.message || 'Failed to analyze. Try again!');
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 max-w-sm bg-black/80 backdrop-blur-sm border border-white/20 rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">Your Music Vibe</h3>
      
      {!vibe && !loading && (
        <button
          onClick={getVibeAnalysis}
          className="w-full border border-white/30 px-4 py-2 rounded hover:bg-white/10 transition-colors text-sm"
        >
          Analyze My Taste
        </button>
      )}

      {loading && (
        <div className="text-xs text-white/50 text-center py-4">
          Analyzing your playlists...
        </div>
      )}

      {error && (
        <div className="space-y-2">
          <div className="text-xs text-red-400 text-center py-2">
            {error}
          </div>
          <button
            onClick={getVibeAnalysis}
            className="w-full border border-white/30 px-4 py-2 rounded hover:bg-white/10 transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      )}

      {vibe && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/5 p-2 rounded">
              <div className="text-white/50">BPM</div>
              <div className="font-semibold">{Math.round(vibe.bpm)}</div>
            </div>
            <div className="bg-white/5 p-2 rounded">
              <div className="text-white/50">Energy</div>
              <div className="font-semibold">{(vibe.energy * 100).toFixed(0)}%</div>
            </div>
            <div className="bg-white/5 p-2 rounded">
              <div className="text-white/50">Dance</div>
              <div className="font-semibold">{(vibe.dance * 100).toFixed(0)}%</div>
            </div>
            <div className="bg-white/5 p-2 rounded">
              <div className="text-white/50">Mood</div>
              <div className="font-semibold">{(vibe.valence * 100).toFixed(0)}%</div>
            </div>
          </div>

          {recommendations.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-white/50 mt-4 mb-2">
                Recommended Afrobeats:
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {recommendations.slice(0, 5).map((track) => (
                  <div
                    key={track.id}
                    className="text-xs bg-white/5 p-2 rounded hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <div className="font-medium truncate">{track.name}</div>
                    <div className="text-white/50 truncate">
                      {track.artists.map(a => a.name).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

