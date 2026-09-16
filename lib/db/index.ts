import "dotenv/config"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

function createDb() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and point it at your Postgres database, " +
        "e.g. postgresql://user:password@host/gamonix?sslmode=require"
    )
  }

  // postgres-js reads sslmode from the URL, which hosted providers (Neon,
  // Supabase, RDS) require.
  return drizzle({ client: postgres(connectionString, { max: 10 }) })
}

export type Database = ReturnType<typeof createDb>

// Reuse the connection across hot reloads in development so `next dev` does not
// exhaust the Postgres connection pool.
const globalForDb = globalThis as unknown as { __gamonixDb?: Database }

/**
 * Connects lazily on first query so that importing this module (during a build,
 * for example) never requires a live database.
 */
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = (globalForDb.__gamonixDb ??= createDb())
    const value = Reflect.get(instance, property)
    return typeof value === "function" ? value.bind(instance) : value
  },
})
