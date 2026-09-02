"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/lib/db"
import { teamMembers, teams } from "@/lib/db/schema"
import { MAX_TEAM_MEMBERS } from "@/lib/tournament/constants"
import {
  deleteTeamLogo,
  InvalidLogoError,
  saveTeamLogo,
} from "@/lib/tournament/logo-storage"
import { logoSchema, registrationSchema } from "@/lib/tournament/validation"

export type RegistrationState = {
  status: "idle" | "success" | "error"
  message: string
  /** Errors keyed by field path, e.g. `teamName` or `members.1.email`. */
  fieldErrors: Record<string, string>
  team?: { id: string; teamName: string; memberCount: number }
}

export const initialRegistrationState: RegistrationState = {
  status: "idle",
  message: "",
  fieldErrors: {},
}

/** Maps a database unique index onto the form field that caused it. */
const UNIQUE_VIOLATIONS: Record<string, { field: string; message: string }> = {
  teams_team_name_unique: {
    field: "teamName",
    message: "A team is already registered under this name",
  },
  teams_igl_email_unique: {
    field: "iglEmail",
    message: "This email is already registered as an IGL for another team",
  },
  teams_igl_phone_unique: {
    field: "iglPhone",
    message: "This phone number is already registered as an IGL for another team",
  },
  team_members_ign_unique: {
    field: "members",
    message: "One of these In-Game IDs is already rostered on another team",
  },
  team_members_email_unique: {
    field: "members",
    message: "One of these email addresses is already rostered on another team",
  },
}

function readMembers(formData: FormData) {
  const count = Number(formData.get("memberCount") ?? 0)
  if (!Number.isInteger(count) || count < 0 || count > MAX_TEAM_MEMBERS) {
    return []
  }

  return Array.from({ length: count }, (_, index) => ({
    fullName: String(formData.get(`members[${index}].fullName`) ?? ""),
    phone: String(formData.get(`members[${index}].phone`) ?? ""),
    email: String(formData.get(`members[${index}].email`) ?? ""),
    inGameId: String(formData.get(`members[${index}].inGameId`) ?? ""),
  }))
}

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".")
    // Keep the first message per field so the UI shows the most relevant one.
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message
  }
  return fieldErrors
}

export async function registerTeam(
  _previousState: RegistrationState,
  formData: FormData
): Promise<RegistrationState> {
  const parsed = registrationSchema.safeParse({
    teamName: formData.get("teamName") ?? "",
    iglName: formData.get("iglName") ?? "",
    iglPhone: formData.get("iglPhone") ?? "",
    iglEmail: formData.get("iglEmail") ?? "",
    members: readMembers(formData),
  })

  const logo = logoSchema.safeParse(formData.get("logo"))

  if (!parsed.success || !logo.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields and submit again.",
      fieldErrors: {
        ...(parsed.success ? {} : toFieldErrors(parsed.error)),
        ...(logo.success
          ? {}
          : { logo: logo.error.issues[0]?.message ?? "Invalid team logo" }),
      },
    }
  }

  const registration = parsed.data
  let storedLogo: Awaited<ReturnType<typeof saveTeamLogo>> | undefined
  let team: { id: string; teamName: string }

  try {
    storedLogo = await saveTeamLogo(logo.data)

    team = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(teams)
        .values({
          teamName: registration.teamName,
          logoUrl: storedLogo!.url,
          logoMimeType: storedLogo!.mimeType,
          logoSizeBytes: storedLogo!.sizeBytes,
          iglName: registration.iglName,
          iglPhone: registration.iglPhone,
          iglEmail: registration.iglEmail,
        })
        .returning({ id: teams.id, teamName: teams.teamName })

      await tx.insert(teamMembers).values(
        registration.members.map((member, index) => ({
          teamId: inserted.id,
          fullName: member.fullName,
          phone: member.phone,
          email: member.email,
          inGameId: member.inGameId,
          position: index + 1,
        }))
      )

      return inserted
    })

  } catch (error) {
    if (storedLogo) await deleteTeamLogo(storedLogo.url)

    if (error instanceof InvalidLogoError) {
      return {
        status: "error",
        message: "Please fix the highlighted fields and submit again.",
        fieldErrors: { logo: error.message },
      }
    }

    const conflict = matchUniqueViolation(error)
    if (conflict) {
      return {
        status: "error",
        message: "This registration conflicts with an existing one.",
        fieldErrors: { [conflict.field]: conflict.message },
      }
    }

    console.error("Team registration failed", error)
    return {
      status: "error",
      message:
        "Something went wrong while saving the registration. Please try again.",
      fieldErrors: {},
    }
  }

  // Outside the try/catch: the registration is committed at this point, so a
  // failure here must never be reported to the IGL as a failed submission.
  revalidatePath("/admin/registrations")

  return {
    status: "success",
    message: `${team.teamName} is registered. Tournament organizers will review the roster and contact the IGL.`,
    fieldErrors: {},
    team: {
      id: team.id,
      teamName: team.teamName,
      memberCount: registration.members.length,
    },
  }
}

/**
 * Drizzle wraps driver errors in a `DrizzleQueryError`, so the Postgres error
 * carrying the violated constraint sits somewhere on the `cause` chain.
 */
function matchUniqueViolation(error: unknown) {
  let current: unknown = error

  while (typeof current === "object" && current !== null) {
    const { code, constraint_name: constraintName } = current as {
      code?: string
      constraint_name?: string
    }
    if (code === "23505" && constraintName) {
      return UNIQUE_VIOLATIONS[constraintName] ?? null
    }
    current = (current as { cause?: unknown }).cause
  }

  return null
}
