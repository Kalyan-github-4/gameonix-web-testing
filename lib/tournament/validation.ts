import { z } from "zod"

import {
  ACCEPTED_LOGO_TYPES,
  MAX_LOGO_BYTES,
  MAX_TEAM_MEMBERS,
  MIN_TEAM_MEMBERS,
} from "./constants"

/**
 * Strips formatting characters so `+91 98765-43210` and `+919876543210`
 * are treated as the same number for validation and duplicate detection.
 */
export function normalizePhone(value: string): string {
  return value.replace(/[\s()\-.]/g, "")
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

/** Collapses inner whitespace, used for names, team names and IGNs. */
export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .transform(normalizePhone)
  .refine(
    (value) => /^\+?[1-9]\d{9,14}$/.test(value),
    "Enter a valid phone number (10–15 digits, optionally with a country code)"
  )

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email address is required")
  .transform(normalizeEmail)
  .pipe(z.email("Enter a valid email address"))
  .refine((value) => value.length <= 254, "Email address is too long")

const personNameSchema = z
  .string()
  .trim()
  .transform(normalizeText)
  .pipe(
    z
      .string()
      .min(2, "Enter the full name (at least 2 characters)")
      .max(80, "Name must be 80 characters or fewer")
      .regex(
        /^[\p{L}][\p{L}\p{M}'.\- ]*$/u,
        "Name may only contain letters, spaces, apostrophes, hyphens and periods"
      )
  )

export const teamMemberSchema = z.object({
  fullName: personNameSchema,
  phone: phoneSchema,
  email: emailSchema,
  inGameId: z
    .string()
    .trim()
    .min(3, "In-Game ID must be at least 3 characters")
    .max(40, "In-Game ID must be 40 characters or fewer")
    .regex(
      /^[A-Za-z0-9._\-\[\]|]+$/,
      "In-Game ID may only contain letters, numbers and . _ - [ ] |"
    ),
})

export type TeamMemberInput = z.infer<typeof teamMemberSchema>

/** Fields the IGL fills in for the team itself. */
export const teamDetailsSchema = z.object({
  teamName: z
    .string()
    .trim()
    .transform(normalizeText)
    .pipe(
      z
        .string()
        .min(3, "Team name must be at least 3 characters")
        .max(50, "Team name must be 50 characters or fewer")
        .regex(
          /^[\p{L}\p{N}][\p{L}\p{N}'.\-_ ]*$/u,
          "Team name may only contain letters, numbers, spaces and . - _ '"
        )
    ),
  iglName: personNameSchema,
  iglPhone: phoneSchema,
  iglEmail: emailSchema,
})

/**
 * Full registration payload. Cross-field rules (duplicate members, roster size)
 * live here so the client and the server enforce exactly the same thing.
 */
export const registrationSchema = teamDetailsSchema
  .extend({
    members: z
      .array(teamMemberSchema)
      .min(MIN_TEAM_MEMBERS, `Add at least ${MIN_TEAM_MEMBERS} team members`)
      .max(MAX_TEAM_MEMBERS, `A team can have at most ${MAX_TEAM_MEMBERS} members`),
  })
  .superRefine((data, ctx) => {
    const seen = {
      email: new Map<string, number>(),
      phone: new Map<string, number>(),
      inGameId: new Map<string, number>(),
    }
    const labels = {
      email: "email address",
      phone: "phone number",
      inGameId: "In-Game ID",
    } as const

    data.members.forEach((member, index) => {
      const keys = {
        email: member.email,
        phone: member.phone,
        inGameId: member.inGameId.toLowerCase(),
      }

      for (const field of ["email", "phone", "inGameId"] as const) {
        const previous = seen[field].get(keys[field])
        if (previous === undefined) {
          seen[field].set(keys[field], index)
          continue
        }
        ctx.addIssue({
          code: "custom",
          path: ["members", index, field],
          message: `This ${labels[field]} is already used by member ${previous + 1}`,
        })
      }
    })
  })

export type RegistrationInput = z.input<typeof registrationSchema>
export type RegistrationData = z.output<typeof registrationSchema>

/** Validates the uploaded team logo. Runs on both the client and the server. */
export const logoSchema = z
  .instanceof(File, { message: "Upload a team logo" })
  .refine((file) => file.size > 0, "Upload a team logo")
  .refine(
    (file) => file.size <= MAX_LOGO_BYTES,
    `Logo must be ${Math.round(MAX_LOGO_BYTES / (1024 * 1024))} MB or smaller`
  )
  .refine(
    (file) =>
      (ACCEPTED_LOGO_TYPES as readonly string[]).includes(file.type),
    "Logo must be a PNG, JPEG or WebP image"
  )
