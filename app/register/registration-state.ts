/**
 * Shared shape of the registration form's action state.
 *
 * This lives outside `actions.ts` because a `"use server"` module may only
 * export async functions — exporting the initial-state object from there is a
 * build error.
 */
export type RegistrationState = {
  status: "idle" | "success" | "error"
  message: string
  /** Errors keyed by field path, e.g. `teamName` or `members.1.email`. */
  fieldErrors: Record<string, string>
  team?: {
    id: string
    teamName: string
    memberCount: number
    iglEmail: string
    /** Addresses the verification mail could not reach. */
    undelivered: string[]
  }
}

export const initialRegistrationState: RegistrationState = {
  status: "idle",
  message: "",
  fieldErrors: {},
}
