// lib/spotifyToken.ts

let inflight: Promise<{ token: string; expiresAt: number }> | null = null;
let last: { token: string; expiresAt: number } | null = null;

export async function getFreshSpotifyToken(): Promise<{
  token: string;
  expiresAt: number;
}> {
  // Return cached if still valid (>30s remaining)
  if (last && last.expiresAt > Date.now() + 30_000) {
    return last;
  }

  // Avoid fan-out if multiple callers hit this simultaneously
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/spotify/access-token", {
        cache: "no-store",
        credentials: "include", // important for NextAuth session
      });

      if (!res.ok) {
        const text = await res.text();
        console.warn(
          `[Token] /api/spotify/access-token ${res.status}: ${text}`
        );
        throw new Error(`token endpoint ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (!data?.accessToken) {
        throw new Error("No accessToken in response");
      }

      const expiresAt = Number(data.expiresAt ?? Date.now() + 55 * 60 * 1000);

      last = { token: data.accessToken as string, expiresAt };
      return last;
    } catch (err) {
      console.error("[Token] Failed to get fresh Spotify token:", err);
      if (last) {
        console.warn("[Token] Using stale cached token");
        return last;
      }
      throw err;
    } finally {
      setTimeout(() => {
        inflight = null;
      }, 100);
    }
  })();

  return inflight;
}



