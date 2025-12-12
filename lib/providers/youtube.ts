const YT_API = "https://www.googleapis.com/youtube/v3";
const KEY = process.env.YOUTUBE_API_KEY!;

export type YTItem = {
  id: { videoId?: string } | string;
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails?: any;
  };
};

export async function ytSearch(q: string, limit = 25) {
  const url = new URL(YT_API + "/search");
  url.searchParams.set("key", KEY);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(limit));
  url.searchParams.set("q", q);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error("YouTube search failed");
  const j = await r.json();
  return (j?.items ?? []) as YTItem[];
}


