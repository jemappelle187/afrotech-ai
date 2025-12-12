import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const at = (session as any)?.spotify?.accessToken;
  if (!at) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    // Get user's top tracks (this works with basic auth)
    const topRes = await fetch("https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=medium_term", {
      headers: { Authorization: `Bearer ${at}` }
    });
    
    if (!topRes.ok) {
      return NextResponse.json({ 
        error: "Failed to get your top tracks" 
      }, { status: topRes.status });
    }
    
    const topData = await topRes.json();
    const tracks = topData.items || [];
    
    if (tracks.length === 0) {
      return NextResponse.json({ 
        error: "No listening history found. Play some music and try again!" 
      }, { status: 404 });
    }

    // Calculate simplified "vibe" based on track properties
    // We'll use tempo estimates and track popularity as proxies
    let totalPopularity = 0;
    let explicitCount = 0;
    
    tracks.forEach((track: any) => {
      totalPopularity += track.popularity || 50;
      if (track.explicit) explicitCount++;
    });
    
    const avgPopularity = totalPopularity / tracks.length;
    const explicitRatio = explicitCount / tracks.length;
    
    // Create estimated vibe (these are approximations since we can't access audio features)
    const vibe = {
      bpm: 120, // Default estimate
      energy: Math.min(1, avgPopularity / 100 + 0.3), // Higher popularity = higher energy (approximation)
      dance: Math.min(1, 0.5 + explicitRatio * 0.3), // Just an approximation
      valence: Math.min(1, avgPopularity / 120) // Approximation
    };

    // Get recommendations based on track seeds (this usually works)
    const seedTracks = tracks.slice(0, 5).map((t: any) => t.id).join(',');
    
    const recRes = await fetch(`https://api.spotify.com/v1/recommendations?limit=20&seed_tracks=${seedTracks}&min_popularity=40`, {
      headers: { Authorization: `Bearer ${at}` }
    });
    
    const rec = recRes.ok ? await recRes.json() : { tracks: [] };

    // Filter for Afrobeats-related tracks
    const afrobeatsKeywords = ['afro', 'african', 'amapiano', 'dancehall', 'afrobeat'];
    const afroRecs = rec.tracks?.filter((track: any) => {
      const searchText = `${track.name} ${track.artists?.map((a: any) => a.name).join(' ')}`.toLowerCase();
      return afrobeatsKeywords.some(keyword => searchText.includes(keyword));
    }) || [];
    
    // If no afrobeats in recommendations, search for afrobeats explicitly
    let finalRecs = afroRecs.length > 0 ? afroRecs : rec.tracks || [];
    
    if (afroRecs.length < 5) {
      const searchRes = await fetch(
        `https://api.spotify.com/v1/search?q=genre:afrobeats&type=track&limit=10`,
        { headers: { Authorization: `Bearer ${at}` } }
      );
      
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        finalRecs = [...afroRecs, ...(searchData.tracks?.items || [])].slice(0, 20);
      }
    }

    return NextResponse.json({
      vibe,
      recommendations: finalRecs.slice(0, 20),
      note: "Vibe analysis based on your top tracks (audio features unavailable)"
    });
    
  } catch (error) {
    console.error('Alternative vibe analysis error:', error);
    return NextResponse.json({ 
      error: "Failed to analyze. Please try again." 
    }, { status: 500 });
  }
}



