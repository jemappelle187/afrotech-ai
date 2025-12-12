import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { address } = await req.json();
  
  if (!address) {
    return NextResponse.json({ error: 'missing' }, { status: 400 });
  }
  
  await pool.query(
    'INSERT INTO emails (address) VALUES ($1) ON CONFLICT (address) DO NOTHING', 
    [address]
  );
  
  return NextResponse.json({ ok: true });
}




