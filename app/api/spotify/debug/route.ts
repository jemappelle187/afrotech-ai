import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const at = (session as any)?.spotify?.accessToken;
  
  if (!at) {
    return NextResponse.json({ 
      error: "Not logged in",
      session: !!session 
    });
  }

  const results: any = {
    hasToken: true,
    tokenPreview: at.substring(0, 20) + "...",
    tests: {}
  };

  // Test 1: Get playlists
  try {
    const plsRes = await fetch("https://api.spotify.com/v1/me/playlists?limit=3", {
      headers: { Authorization: `Bearer ${at}` }
    });
    results.tests.playlists = {
      status: plsRes.status,
      ok: plsRes.ok,
      data: plsRes.ok ? await plsRes.json() : await plsRes.text()
    };
  } catch (err: any) {
    results.tests.playlists = { error: err.message };
  }

  // Test 2: Get saved tracks
  try {
    const savedRes = await fetch("https://api.spotify.com/v1/me/tracks?limit=5", {
      headers: { Authorization: `Bearer ${at}` }
    });
    results.tests.savedTracks = {
      status: savedRes.status,
      ok: savedRes.ok,
      data: savedRes.ok ? await savedRes.json() : await savedRes.text()
    };
  } catch (err: any) {
    results.tests.savedTracks = { error: err.message };
  }

  // Test 3: Get recently played
  try {
    const recentRes = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=5", {
      headers: { Authorization: `Bearer ${at}` }
    });
    results.tests.recentlyPlayed = {
      status: recentRes.status,
      ok: recentRes.ok,
      data: recentRes.ok ? await recentRes.json() : await recentRes.text()
    };
  } catch (err: any) {
    results.tests.recentlyPlayed = { error: err.message };
  }

  // Test 4: Try to get audio features for one track
  const testTrackIds: string[] = [];
  
  // Collect some track IDs
  if (results.tests.recentlyPlayed?.ok) {
    results.tests.recentlyPlayed.data.items?.forEach((item: any) => {
      if (item.track?.id) testTrackIds.push(item.track.id);
    });
  }
  
  if (testTrackIds.length > 0) {
    const testId = testTrackIds[0];
    try {
      const featRes = await fetch(`https://api.spotify.com/v1/audio-features?ids=${testId}`, {
        headers: { Authorization: `Bearer ${at}` }
      });
      results.tests.audioFeatures = {
        status: featRes.status,
        ok: featRes.ok,
        trackId: testId,
        data: featRes.ok ? await featRes.json() : await featRes.text()
      };
    } catch (err: any) {
      results.tests.audioFeatures = { error: err.message, trackId: testId };
    }
  } else {
    results.tests.audioFeatures = { error: "No tracks found to test" };
  }

  return NextResponse.json(results, { 
    headers: { 'Content-Type': 'application/json' } 
  });
}



