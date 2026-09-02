/**
 * Drizzle wraps driver errors in a `DrizzleQueryError`, so the Postgres error
 * carrying the violated constraint sits somewhere on the `cause` chain.
 */
export function uniqueViolationName(error: unknown): string | null {
  let current: unknown = error

  while (typeof current === "object" && current !== null) {
    const { code, constraint_name: constraintName } = current as {
      code?: string
      constraint_name?: string
    }
    if (code === "23505" && constraintName) return constraintName
    current = (current as { cause?: unknown }).cause
  }

  return null
}
