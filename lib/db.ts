import { Pool, QueryResultRow } from 'pg';

export const pool = new Pool({ 
  connectionString: process.env.POSTGRES_URL 
});

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]) {
  const res = await pool.query<T>(text, params);
  return res.rows;
}



