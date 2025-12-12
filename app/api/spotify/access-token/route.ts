import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

// Refresh using stored refresh_token if needed
async function refreshWithSpotify(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    client_secret: process.env.SPOTIFY_CLIENT_SECRET!,
  });
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`spotify refresh failed: ${res.status}`);
  const json = await res.json();
  const expiresAt = Date.now() + (json.expires_in ?? 3600) * 1000 - 30_000;
  return {
    accessToken: json.access_token as string,
    refreshToken: json.refresh_token as string | undefined,
    expiresAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, raw: false });
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let accessToken = (token as any).accessToken as string | undefined;
    let refreshToken = (token as any).refreshToken as string | undefined;
    let expiresAt = (token as any).accessTokenExpires as number | undefined;

    const needsRefresh =
      !accessToken || !expiresAt || Date.now() >= Number(expiresAt) - 15_000;

    if (needsRefresh) {
      if (!refreshToken) {
        return NextResponse.json({ error: "no_refresh_token" }, { status: 401 });
      }
      const refreshed = await refreshWithSpotify(refreshToken);
      accessToken = refreshed.accessToken;
      expiresAt = refreshed.expiresAt;
    }

    return NextResponse.json({ accessToken, expiresAt }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "token_error" },
      { status: 500 }
    );
  }
}



