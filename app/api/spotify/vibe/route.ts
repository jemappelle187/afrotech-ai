import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const at = (session as any)?.spotify?.accessToken;
  if (!at) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const trackIds: string[] = [];
    
    // Try to fetch user's playlists
    try {
      const plsRes = await fetch("https://api.spotify.com/v1/me/playlists?limit=20", {
        headers: { Authorization: `Bearer ${at}` }
      });
      
      if (plsRes.ok) {
        const pls = await plsRes.json();
        
        // Get tracks from first 3 playlists
        for (const p of pls.items?.slice(0, 3) ?? []) {
          const tr = await fetch(`https://api.spotify.com/v1/playlists/${p.id}/tracks?limit=50`, {
            headers: { Authorization: `Bearer ${at}` }
          }).then(r => r.ok ? r.json() : null);
          
          if (tr) {
            (tr.items ?? []).forEach((it: any) => { 
              const id = it.track?.id; 
              if (id) trackIds.push(id); 
            });
          }
        }
      }
    } catch (err) {
      console.error('Error fetching playlists:', err);
    }
    
    // If no tracks from playlists, try saved tracks
    if (trackIds.length < 10) {
      try {
        const savedRes = await fetch("https://api.spotify.com/v1/me/tracks?limit=50", {
          headers: { Authorization: `Bearer ${at}` }
        });
        
        if (savedRes.ok) {
          const saved = await savedRes.json();
          (saved.items ?? []).forEach((it: any) => {
            const id = it.track?.id;
            if (id) trackIds.push(id);
          });
        }
      } catch (err) {
        console.error('Error fetching saved tracks:', err);
      }
    }
    
    // If still no tracks, try recently played
    if (trackIds.length < 10) {
      try {
        const recentRes = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=50", {
          headers: { Authorization: `Bearer ${at}` }
        });
        
        if (recentRes.ok) {
          const recent = await recentRes.json();
          (recent.items ?? []).forEach((it: any) => {
            const id = it.track?.id;
            if (id) trackIds.push(id);
          });
        }
      } catch (err) {
        console.error('Error fetching recently played:', err);
      }
    }
    
    // Remove duplicates and limit to 50 tracks (safer batch size)
    const uniqueIds = Array.from(new Set(trackIds)).slice(0, 50);
    
    if (!uniqueIds.length) {
      return NextResponse.json({ 
        error: "No music found in your library. Try saving some tracks or creating playlists!" 
      }, { status: 404 });
    }

    console.log(`Analyzing ${uniqueIds.length} tracks...`);

    // Get audio features - try with all tracks first
    let featsRes = await fetch(`https://api.spotify.com/v1/audio-features?ids=${uniqueIds.join(",")}`, {
      headers: { Authorization: `Bearer ${at}` }
    });
    
    // If failed, try with fewer tracks (first 20)
    if (!featsRes.ok && uniqueIds.length > 20) {
      console.log(`Failed with ${uniqueIds.length} tracks, trying with 20...`);
      const shorterIds = uniqueIds.slice(0, 20);
      featsRes = await fetch(`https://api.spotify.com/v1/audio-features?ids=${shorterIds.join(",")}`, {
        headers: { Authorization: `Bearer ${at}` }
      });
    }
    
    if (!featsRes.ok) {
      const errorText = await featsRes.text();
      console.error('Spotify audio features error:', featsRes.status, errorText);
      
      // Provide specific error messages based on status
      let errorMsg = 'Failed to analyze tracks';
      if (featsRes.status === 429) {
        errorMsg = 'Rate limited. Please wait 30 seconds and try again.';
      } else if (featsRes.status === 401) {
        errorMsg = 'Session expired. Please disconnect and reconnect Spotify.';
      } else if (featsRes.status === 400) {
        errorMsg = 'Invalid track data. This might be a temporary issue.';
      }
      
      return NextResponse.json({ 
        error: errorMsg 
      }, { status: featsRes.status });
    }
    
    const feats = await featsRes.json();
    console.log(`Got audio features for ${feats.audio_features?.length || 0} tracks`);

    // Calculate average features
    const vals = { bpm: 0, energy: 0, dance: 0, valence: 0 };
    let n = 0;
    
    for (const f of feats.audio_features ?? []) {
      if (!f) continue;
      vals.bpm += f.tempo ?? 0;
      vals.energy += f.energy ?? 0;
      vals.dance += f.danceability ?? 0;
      vals.valence += f.valence ?? 0;
      n++;
    }
    
    if (n === 0) {
      return NextResponse.json({ 
        error: "Could not analyze your music" 
      }, { status: 500 });
    }
    
    Object.keys(vals).forEach(k => (vals as any)[k] = (vals as any)[k] / Math.max(n, 1));

    // Get recommendations
    const recRes = await fetch(`https://api.spotify.com/v1/recommendations?limit=20&${new URLSearchParams({
      seed_genres: "afrobeat,afro-house,deep-house,house",
      target_danceability: vals.dance.toFixed(2),
      target_energy: vals.energy.toFixed(2),
      target_valence: vals.valence.toFixed(2),
      target_tempo: vals.bpm.toFixed(0),
    })}`, { 
      headers: { Authorization: `Bearer ${at}` } 
    });
    
    const rec = recRes.ok ? await recRes.json() : { tracks: [] };

    return NextResponse.json({ 
      vibe: vals, 
      recommendations: rec.tracks || []
    });
  } catch (error) {
    console.error('Vibe analysis error:', error);
    return NextResponse.json({ 
      error: "Failed to analyze your music. Please try again." 
    }, { status: 500 });
  }
}

