'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface Playlist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
  uri: string;
}

export function PlaylistSelector({ onPlaylistSelect }: { onPlaylistSelect: (playlistUri: string) => void }) {
  const { data: session } = useSession();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (session && isOpen && playlists.length === 0) {
      fetchPlaylists();
    }
  }, [session, isOpen]);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const token = (session as any)?.spotify?.accessToken;
      const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (playlist: Playlist) => {
    setSelected(playlist.name);
    setIsOpen(false);
    onPlaylistSelect(playlist.uri);
  };

  if (!session) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="border border-white/30 px-4 py-2 rounded hover:bg-white/10 transition-colors text-sm flex items-center gap-2"
      >
        <span>🎵</span>
        <span>{selected || 'Select Playlist'}</span>
        <span className="text-xs">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-80 max-h-96 overflow-y-auto bg-black/95 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl z-50">
          {loading && (
            <div className="p-4 text-center text-sm text-white/50">
              Loading playlists...
            </div>
          )}

          {!loading && playlists.length === 0 && (
            <div className="p-4 text-center text-sm text-white/50">
              No playlists found
            </div>
          )}

          {!loading && playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => handleSelect(playlist)}
              className="w-full p-3 hover:bg-white/10 transition-colors flex items-center gap-3 text-left"
            >
              {playlist.images?.[0] && (
                <img 
                  src={playlist.images[0].url} 
                  alt={playlist.name}
                  className="w-12 h-12 rounded object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-sm">{playlist.name}</div>
                <div className="text-xs text-white/50">{playlist.tracks.total} tracks</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}




