const SC_API = "https://api-v2.soundcloud.com";
const CLIENT_ID = process.env.SOUNDCLOUD_CLIENT_ID!;

export type SCTrack = {
  id: number;
  title: string;
  duration: number; // ms
  user?: { username?: string };
  artwork_url?: string | null;
  media?: any;
  permalink_url?: string;
  streamable?: boolean;
};

export async function scSearch(q: string, limit = 25) {
  const url = new URL(SC_API + "/search/tracks");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("client_id", CLIENT_ID);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error("SoundCloud search failed");
  const j = await r.json();
  return (j?.collection ?? []) as SCTrack[];
}

// Get a progressive mp3 URL if available (best for WebAudio + analysis)
export async function scStreamUrl(trackId: number) {
  const url = new URL(SC_API + `/tracks/${trackId}`);
  url.searchParams.set("client_id", CLIENT_ID);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error("SoundCloud track lookup failed");
  const t = (await r.json()) as SCTrack;
  // v2 media transcodings
  const tr = t?.media?.transcodings ?? [];
  const progressive = tr.find((x: any) =>
    String(x?.format?.protocol).includes("progressive")
  );
  const chosen = progressive ?? tr[0];
  if (!chosen?.url) throw new Error("No SC stream available");
  const r2 = await fetch(chosen.url + `?client_id=${CLIENT_ID}`);
  if (!r2.ok) throw new Error("SoundCloud stream resolve failed");
  const j2 = await r2.json();
  return j2?.url as string;
}


