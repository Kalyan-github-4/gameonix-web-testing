import "dotenv/config"
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

// Reuse the connection across hot reloads in development so `next dev` does not
// exhaust the Postgres connection pool.
const globalForDb = globalThis as unknown as {
  __gamonixDb?: PostgresJsDatabase<typeof schema>
}

function createDb(): PostgresJsDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and point it at your Postgres database."
    )
  }

  return drizzle(postgres(connectionString, { max: 10 }), { schema })
}

/**
 * Connects lazily on first query so that importing this module (during a build,
 * for example) never requires a live database.
 */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, property) {
    const instance = (globalForDb.__gamonixDb ??= createDb())
    const value = Reflect.get(instance, property)
    return typeof value === "function" ? value.bind(instance) : value
  },
})

export { schema }
