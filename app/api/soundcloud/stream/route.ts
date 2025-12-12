import { NextResponse } from "next/server";
import { scStreamUrl } from "@/lib/providers/soundcloud";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id") || 0);
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  try {
    const url = await scStreamUrl(id);
    // Return a short-lived redirect so the client plays via <audio> with CORS
    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}


