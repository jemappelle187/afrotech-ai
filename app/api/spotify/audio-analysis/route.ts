import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "missing id" }, { status: 400 });

  const session = await getServerSession(authOptions);
  const token = (session as any)?.spotify?.accessToken;
  if (!token)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const res = await fetch(
    `https://api.spotify.com/v1/audio-analysis/${encodeURIComponent(id)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );

  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      { error: text || res.statusText },
      { status: res.status }
    );
  }
  return new NextResponse(text, {
    headers: { "content-type": "application/json" },
  });
}



