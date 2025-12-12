import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const token = (session as any)?.spotify?.accessToken;
    if (!token) {
      return NextResponse.json({ error: "no_token" }, { status: 401 });
    }

    const body = await req.json();
    const { device_ids, play } = body;

    const res = await fetch("https://api.spotify.com/v1/me/player", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_ids, play: play ?? false }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `spotify transfer failed: ${res.status}`, details: text },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "transfer_error" },
      { status: 500 }
    );
  }
}



