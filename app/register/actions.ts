"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/lib/db"
import { uniqueViolationName } from "@/lib/db/errors"
import { teamMembers, teams } from "@/lib/db/schema"
import { MAX_TEAM_MEMBERS } from "@/lib/tournament/constants"
import {
  deleteTeamLogo,
  InvalidLogoError,
  saveTeamLogo,
} from "@/lib/tournament/logo-storage"
import { logoSchema, registrationSchema } from "@/lib/tournament/validation"
import {
  dispatchVerificationEmails,
  mintVerificationToken,
  verificationDeadline,
} from "@/lib/verification/service"

import type { RegistrationState } from "./registration-state"

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
  teams_igl_ign_unique: {
    field: "iglInGameId",
    message: "This In-Game ID is already registered as an IGL for another team",
  },
  team_members_ign_unique: {
    field: "members",
    message: "One of these In-Game IDs is already rostered on another team",
  },
  team_members_email_unique: {
    field: "members",
    message: "One of these email addresses is already rostered on another team",
  },
  team_members_phone_unique: {
    field: "members",
    message: "One of these phone numbers is already rostered on another team",
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
    inGameName: String(formData.get(`members[${index}].inGameName`) ?? ""),
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
    iglInGameName: formData.get("iglInGameName") ?? "",
    iglInGameId: formData.get("iglInGameId") ?? "",
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

  // Link tokens are minted before the insert so the plaintext is available to
  // the mailer afterwards; only the digests are ever written.
  const hubToken = mintVerificationToken()
  const memberTokens = registration.members.map(() => mintVerificationToken())

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
          iglInGameName: registration.iglInGameName,
          iglInGameId: registration.iglInGameId,
          hubTokenHash: hubToken.hash,
          verificationExpiresAt: verificationDeadline(),
        })
        .returning({ id: teams.id, teamName: teams.teamName })

      await tx.insert(teamMembers).values(
        registration.members.map((member, index) => ({
          teamId: inserted.id,
          fullName: member.fullName,
          phone: member.phone,
          email: member.email,
          inGameName: member.inGameName,
          inGameId: member.inGameId,
          position: index + 1,
          verifyTokenHash: memberTokens[index].hash,
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

    const constraint = uniqueViolationName(error)
    const conflict = constraint ? UNIQUE_VIOLATIONS[constraint] : null
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
  const dispatch = await dispatchVerificationEmails({
    team: {
      teamName: team.teamName,
      iglName: registration.iglName,
      iglEmail: registration.iglEmail,
    },
    hubToken: hubToken.token,
    members: registration.members.map((member, index) => ({
      fullName: member.fullName,
      email: member.email,
      token: memberTokens[index].token,
    })),
  })

  revalidatePath("/admin/registrations")

  return {
    status: "success",
    message: `${team.teamName} is registered. Check your inbox for the roster dashboard link — every player has been emailed their own verification link.`,
    fieldErrors: {},
    team: {
      id: team.id,
      teamName: team.teamName,
      memberCount: registration.members.length,
      iglEmail: registration.iglEmail,
      undelivered: dispatch.failed,
    },
  }
}
