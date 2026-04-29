// Drizzle client for server-only direct Postgres access. Use sparingly —
// most reads should go through the Supabase client so RLS applies. Reach for
// Drizzle when you need a complex join, vector search, or aggregate query.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.SUPABASE_DB_URL;

let _db: ReturnType<typeof drizzle> | null = null;

export function db() {
  if (!_db) {
    if (!url) {
      throw new Error(
        "SUPABASE_DB_URL is not set. Add it to .env.local — see .env.example.",
      );
    }
    const queryClient = postgres(url, {
      // Single-connection-per-request model is fine for App Router server work.
      max: 1,
      prepare: false,
    });
    _db = drizzle(queryClient, { schema });
  }
  return _db;
}

export { schema };
