import { NextResponse } from "next/server";
import { scSearch } from "@/lib/providers/soundcloud";
import { ytSearch } from "@/lib/providers/youtube";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const limit = Number(searchParams.get("limit") || 20);
  if (!q) return NextResponse.json({ items: [] });
  const [sc, yt] = await Promise.allSettled([scSearch(q, limit), ytSearch(q, limit)]);
  const items: any[] = [];
  if (sc.status === "fulfilled") {
    items.push(
      ...sc.value.map((t) => ({
        id: String(t.id),
        title: t.title,
        artists: [t.user?.username].filter(Boolean),
        durationMs: t.duration ?? null,
        source: "soundcloud",
        artwork: t.artwork_url ?? null,
      }))
    );
  }
  if (yt.status === "fulfilled") {
    items.push(
      ...yt.value.map((v) => ({
        id: typeof v.id === "string" ? v.id : v.id?.videoId,
        title: v.snippet?.title,
        artists: [v.snippet?.channelTitle].filter(Boolean),
        durationMs: null,
        source: "youtube",
        artwork:
          v.snippet?.thumbnails?.medium?.url ||
          v.snippet?.thumbnails?.default?.url ||
          null,
      }))
    );
  }
  return NextResponse.json({ items });
}


