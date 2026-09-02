import { and, desc, eq, gt, isNull, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { uniqueViolationName } from "@/lib/db/errors"
import {
  teamMembers,
  teams,
  verificationChallenges,
  type Team,
  type TeamMember,
} from "@/lib/db/schema"
import { sendMail } from "@/lib/mail/client"
import { iglHubMail, memberVerificationMail } from "@/lib/mail/templates"
import { sendSms, shouldEchoCode } from "@/lib/sms"
import {
  LINK_RESEND_COOLDOWN_SECONDS,
  MAX_LINK_SENDS_PER_MEMBER,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_DAY,
  OTP_MAX_TEAM_SENDS_PER_DAY,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
  VERIFICATION_WINDOW_HOURS,
} from "@/lib/tournament/constants"
import { emailSchema, memberSelfEditSchema } from "@/lib/tournament/validation"

import { appUrl, verificationEnabled } from "./config"
import { generateOtp, hashOtp, hashToken, mintToken, otpMatches } from "./crypto"

const ONE_DAY_MS = 86_400_000

/* --------------------------------------------------------------- links -- */

export function memberLink(token: string): string {
  return `${appUrl()}/verify/${token}`
}

export function hubLink(token: string): string {
  return `${appUrl()}/verify/team/${token}`
}

export function verificationDeadline(from = new Date()): Date {
  return new Date(from.getTime() + VERIFICATION_WINDOW_HOURS * 3_600_000)
}

/** Mints a link token. The plaintext exists only in the caller's memory. */
export const mintVerificationToken = mintToken

/* ------------------------------------------------------------- loading -- */

export type MemberContext = { team: Team; member: TeamMember }
export type HubContext = { team: Team; members: TeamMember[] }

export async function loadMemberByToken(
  token: string
): Promise<MemberContext | null> {
  const rows = await db
    .select({ member: teamMembers, team: teams })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.verifyTokenHash, hashToken(token)))
    .limit(1)

  return rows[0] ?? null
}

export async function loadHubByToken(token: string): Promise<HubContext | null> {
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.hubTokenHash, hashToken(token)))
    .limit(1)

  if (!team) return null

  const members = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.teamId, team.id))
    .orderBy(teamMembers.position)

  return { team, members }
}

export function isWindowClosed(team: Team): boolean {
  return (
    team.status === "expired" ||
    team.verificationExpiresAt.getTime() < Date.now()
  )
}

/* --------------------------------------------------------- OTP subject -- */

/**
 * The IGL and each player verify a phone the same way; the only difference is
 * which row the timestamp lands on. A null `memberId` means the IGL.
 */
export type OtpSubject = {
  teamId: string
  memberId: string | null
  destination: string
  teamName: string
}

export function iglSubject(team: Team): OtpSubject {
  return {
    teamId: team.id,
    memberId: null,
    destination: team.iglPhone,
    teamName: team.teamName,
  }
}

export function memberSubject(team: Team, member: TeamMember): OtpSubject {
  return {
    teamId: team.id,
    memberId: member.id,
    destination: member.phone,
    teamName: team.teamName,
  }
}

function subjectFilter(subject: OtpSubject) {
  return and(
    eq(verificationChallenges.teamId, subject.teamId),
    subject.memberId === null
      ? isNull(verificationChallenges.memberId)
      : eq(verificationChallenges.memberId, subject.memberId),
    eq(verificationChallenges.channel, "phone")
  )
}

/* ----------------------------------------------------------- OTP state -- */

export type OtpState = {
  /** A live, unconsumed code exists for the current destination. */
  challengeOpen: boolean
  attemptsLeft: number
  /** ISO timestamp; null when a resend is available right now. */
  resendAvailableAt: string | null
  sendsRemaining: number
}

export async function readOtpState(subject: OtpSubject): Promise<OtpState> {
  const since = new Date(Date.now() - ONE_DAY_MS)

  const [latestRows, sendRows] = await Promise.all([
    db
      .select()
      .from(verificationChallenges)
      .where(subjectFilter(subject))
      .orderBy(desc(verificationChallenges.createdAt))
      .limit(1),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(verificationChallenges)
      .where(
        and(subjectFilter(subject), gt(verificationChallenges.createdAt, since))
      ),
  ])

  const latest = latestRows[0]
  const now = Date.now()

  const open =
    !!latest &&
    !latest.consumedAt &&
    latest.expiresAt.getTime() > now &&
    latest.destination === subject.destination

  const cooldownEnds = latest
    ? latest.createdAt.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000
    : 0

  return {
    challengeOpen: open,
    attemptsLeft: open
      ? Math.max(OTP_MAX_ATTEMPTS - latest.attempts, 0)
      : OTP_MAX_ATTEMPTS,
    resendAvailableAt:
      cooldownEnds > now ? new Date(cooldownEnds).toISOString() : null,
    sendsRemaining: Math.max(OTP_MAX_SENDS_PER_DAY - (sendRows[0]?.n ?? 0), 0),
  }
}

/* ------------------------------------------------------------- sending -- */

export type SendOutcome =
  | { ok: true; state: OtpState; devCode?: string }
  | { ok: false; message: string; state: OtpState }

export async function sendPhoneOtp(subject: OtpSubject): Promise<SendOutcome> {
  const state = await readOtpState(subject)

  if (!verificationEnabled()) {
    return {
      ok: false,
      message: "Verification is paused right now. Try again shortly.",
      state,
    }
  }
  if (state.resendAvailableAt) {
    return {
      ok: false,
      message: "Hold on a moment before asking for another code.",
      state,
    }
  }
  if (state.sendsRemaining <= 0) {
    return {
      ok: false,
      message:
        "Too many codes requested today. Try again tomorrow, or ask the organizers for help.",
      state,
    }
  }

  const teamSends = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(verificationChallenges)
    .where(
      and(
        eq(verificationChallenges.teamId, subject.teamId),
        gt(verificationChallenges.createdAt, new Date(Date.now() - ONE_DAY_MS))
      )
    )

  if ((teamSends[0]?.n ?? 0) >= OTP_MAX_TEAM_SENDS_PER_DAY) {
    return {
      ok: false,
      message:
        "This team has requested too many codes today. Ask the organizers for help.",
      state,
    }
  }

  const code = generateOtp()
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000)

  // Only one code is ever live: asking for a new one retires the old one.
  const challenge = await db.transaction(async (tx) => {
    await tx
      .update(verificationChallenges)
      .set({ consumedAt: new Date() })
      .where(
        and(subjectFilter(subject), isNull(verificationChallenges.consumedAt))
      )

    const [inserted] = await tx
      .insert(verificationChallenges)
      .values({
        teamId: subject.teamId,
        memberId: subject.memberId,
        channel: "phone",
        destination: subject.destination,
        codeHash: hashOtp(code),
        expiresAt,
      })
      .returning({ id: verificationChallenges.id })

    return inserted
  })

  const sms = await sendSms(
    subject.destination,
    `${code} is your Gamonix code for ${subject.teamName}. It expires in ${OTP_TTL_MINUTES} minutes.`
  )

  if (!sms.ok) {
    // Retire the dead challenge so nobody waits on a code that never left.
    await db
      .update(verificationChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(verificationChallenges.id, challenge.id))

    console.error("[verification] SMS dispatch failed:", sms.error)
    return {
      ok: false,
      message: "We could not send the code right now. Try again in a minute.",
      state: await readOtpState(subject),
    }
  }

  return {
    ok: true,
    state: await readOtpState(subject),
    ...(shouldEchoCode() ? { devCode: code } : {}),
  }
}

/* ----------------------------------------------------------- verifying -- */

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; message: string; state: OtpState }

export async function verifyPhoneOtp(
  subject: OtpSubject,
  code: string
): Promise<VerifyOutcome> {
  const submitted = code.replace(/\D/g, "")

  const result = await db.transaction(async (tx) => {
    // Lock the row so two tabs racing the same code cannot both win.
    const [challenge] = await tx
      .select()
      .from(verificationChallenges)
      .where(
        and(subjectFilter(subject), isNull(verificationChallenges.consumedAt))
      )
      .orderBy(desc(verificationChallenges.createdAt))
      .limit(1)
      .for("update")

    if (
      !challenge ||
      challenge.expiresAt.getTime() <= Date.now() ||
      challenge.destination !== subject.destination
    ) {
      return { kind: "no-challenge" as const }
    }

    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      await tx
        .update(verificationChallenges)
        .set({ consumedAt: new Date() })
        .where(eq(verificationChallenges.id, challenge.id))
      return { kind: "exhausted" as const }
    }

    if (!otpMatches(submitted, challenge.codeHash)) {
      const attempts = challenge.attempts + 1
      await tx
        .update(verificationChallenges)
        .set({
          attempts,
          ...(attempts >= OTP_MAX_ATTEMPTS ? { consumedAt: new Date() } : {}),
        })
        .where(eq(verificationChallenges.id, challenge.id))
      return {
        kind: "wrong" as const,
        attemptsLeft: OTP_MAX_ATTEMPTS - attempts,
      }
    }

    const now = new Date()
    await tx
      .update(verificationChallenges)
      .set({ consumedAt: now })
      .where(eq(verificationChallenges.id, challenge.id))

    if (subject.memberId === null) {
      await tx
        .update(teams)
        .set({ iglPhoneVerifiedAt: now, updatedAt: now })
        .where(eq(teams.id, subject.teamId))
    } else {
      await tx
        .update(teamMembers)
        .set({ phoneVerifiedAt: now })
        .where(eq(teamMembers.id, subject.memberId))
    }

    return { kind: "ok" as const }
  })

  if (result.kind === "ok") return { ok: true }

  const state = await readOtpState(subject)
  const message =
    result.kind === "wrong"
      ? `That code is not right. ${result.attemptsLeft} attempt${
          result.attemptsLeft === 1 ? "" : "s"
        } left.`
      : result.kind === "exhausted"
        ? "Too many wrong codes. Ask for a new one."
        : "That code has expired. Ask for a new one."

  return { ok: false, message, state }
}

/* --------------------------------------------------- player self-review -- */

export type ConfirmOutcome =
  | { ok: true }
  | { ok: false; message: string; fieldErrors: Record<string, string> }

/**
 * The player's explicit "these details are mine" step. This — not the page
 * load — is what stamps the email verified: a security scanner can fetch a URL
 * but will not fill in and submit a form.
 */
export async function confirmMemberDetails(
  context: MemberContext,
  input: { fullName: string; phone: string; inGameId: string }
): Promise<ConfirmOutcome> {
  const parsed = memberSelfEditSchema.safeParse(input)

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".")
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message
    }
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors,
    }
  }

  const { member } = context
  const phoneChanged = parsed.data.phone !== member.phone
  const now = new Date()

  try {
    await db
      .update(teamMembers)
      .set({
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        inGameId: parsed.data.inGameId,
        emailVerifiedAt: member.emailVerifiedAt ?? now,
        // Changing the number un-proves it. A code already in flight stops
        // matching on its own, because the challenge records where it went.
        ...(phoneChanged ? { phoneVerifiedAt: null } : {}),
      })
      .where(eq(teamMembers.id, member.id))
  } catch (error) {
    const constraint = uniqueViolationName(error)

    if (constraint === "team_members_phone_unique") {
      return {
        ok: false,
        message: "Please fix the highlighted fields.",
        fieldErrors: { phone: "This number is already on another roster" },
      }
    }
    if (
      constraint === "team_members_ign_unique" ||
      constraint === "team_members_team_ign_unique"
    ) {
      return {
        ok: false,
        message: "Please fix the highlighted fields.",
        fieldErrors: {
          inGameId: "This In-Game ID is already on another roster",
        },
      }
    }

    console.error("Member self-confirm failed", error)
    return {
      ok: false,
      message: "Something went wrong saving your details. Try again.",
      fieldErrors: {},
    }
  }

  return { ok: true }
}

/** The IGL's equivalent: opening the hub delivers it, clicking confirms it. */
export async function confirmIglEmail(team: Team): Promise<void> {
  if (team.iglEmailVerifiedAt) return
  const now = new Date()
  await db
    .update(teams)
    .set({ iglEmailVerifiedAt: now, updatedAt: now })
    .where(eq(teams.id, team.id))
}

/* ------------------------------------------------------ roster closeout -- */

export function memberIsVerified(member: TeamMember): boolean {
  return !!member.emailVerifiedAt && !!member.phoneVerifiedAt
}

export function iglIsVerified(team: Team): boolean {
  return !!team.iglEmailVerifiedAt && !!team.iglPhoneVerifiedAt
}

export function rosterIsVerified(team: Team, members: TeamMember[]): boolean {
  return (
    iglIsVerified(team) && members.length > 0 && members.every(memberIsVerified)
  )
}

export type SubmitOutcome = { ok: true } | { ok: false; message: string }

export async function submitRoster(context: HubContext): Promise<SubmitOutcome> {
  const { team, members } = context

  if (team.status !== "awaiting_verification") {
    return { ok: false, message: "This roster has already been submitted." }
  }
  if (isWindowClosed(team)) {
    return {
      ok: false,
      message: "The verification window has closed. Contact the organizers.",
    }
  }
  if (!rosterIsVerified(team, members)) {
    return {
      ok: false,
      message: "Everyone still needs to verify before you can submit.",
    }
  }

  const now = new Date()
  const updated = await db
    .update(teams)
    .set({ status: "pending", rosterSubmittedAt: now, updatedAt: now })
    .where(and(eq(teams.id, team.id), eq(teams.status, "awaiting_verification")))
    .returning({ id: teams.id })

  if (updated.length === 0) {
    return { ok: false, message: "This roster has already been submitted." }
  }

  return { ok: true }
}

/* -------------------------------------------------- re-issuing a link -- */

export type ReissueOutcome =
  | { ok: true; emailChanged: boolean }
  | { ok: false; message: string }

/**
 * The escape hatch for the one thing a player cannot fix themselves: an email
 * the IGL typed wrong. They never receive the link, so the correction has to
 * come from the hub. Re-issuing always mints a fresh token, which kills the
 * old link on the spot.
 */
export async function reissueMemberLink({
  team,
  member,
  newEmail,
}: {
  team: Team
  member: TeamMember
  newEmail?: string
}): Promise<ReissueOutcome> {
  if (isWindowClosed(team) || team.status !== "awaiting_verification") {
    return { ok: false, message: "This roster can no longer be edited." }
  }
  if (!verificationEnabled()) {
    return { ok: false, message: "Verification is paused right now." }
  }

  const now = Date.now()
  if (
    member.linkSentAt &&
    member.linkSentAt.getTime() + LINK_RESEND_COOLDOWN_SECONDS * 1000 > now
  ) {
    return { ok: false, message: "Wait a moment before sending that link again." }
  }
  if (member.linkSendCount >= MAX_LINK_SENDS_PER_MEMBER) {
    return {
      ok: false,
      message: "This link has been sent too many times. Contact the organizers.",
    }
  }

  let email = member.email
  const emailChanged = !!newEmail && newEmail !== member.email

  if (newEmail !== undefined) {
    const parsed = emailSchema.safeParse(newEmail)
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid email" }
    }
    email = parsed.data
  }

  const token = mintToken()

  try {
    await db
      .update(teamMembers)
      .set({
        email,
        verifyTokenHash: token.hash,
        linkSentAt: new Date(),
        linkSendCount: member.linkSendCount + 1,
        // A new address has proven nothing yet.
        ...(emailChanged ? { emailVerifiedAt: null } : {}),
      })
      .where(eq(teamMembers.id, member.id))
  } catch (error) {
    const constraint = uniqueViolationName(error)
    if (
      constraint === "team_members_email_unique" ||
      constraint === "team_members_team_email_unique"
    ) {
      return { ok: false, message: "That email is already on a roster." }
    }
    console.error("Re-issuing member link failed", error)
    return { ok: false, message: "Could not update that player. Try again." }
  }

  const mail = await sendMail(
    memberVerificationMail({
      to: email,
      memberName: member.fullName,
      teamName: team.teamName,
      iglName: team.iglName,
      url: memberLink(token.token),
    })
  )

  if (!mail.ok) {
    return {
      ok: false,
      message: "Saved, but the email could not be sent. Try again in a minute.",
    }
  }

  return { ok: true, emailChanged }
}

/* ------------------------------------------------------------ dispatch -- */

export type DispatchResult = { sent: number; failed: string[] }

/**
 * Fires the link emails once a registration commits. Best-effort by design:
 * the row already exists, so a bounced mail is something the IGL resends from
 * the hub — never a failed submission.
 */
export async function dispatchVerificationEmails({
  team,
  hubToken,
  members,
}: {
  team: Pick<Team, "teamName" | "iglName" | "iglEmail">
  hubToken: string
  members: { fullName: string; email: string; token: string }[]
}): Promise<DispatchResult> {
  if (!verificationEnabled()) return { sent: 0, failed: [] }

  const results = await Promise.all([
    sendMail(
      iglHubMail({
        to: team.iglEmail,
        iglName: team.iglName,
        teamName: team.teamName,
        url: hubLink(hubToken),
      })
    ).then((result) => ({ result, who: team.iglEmail })),
    ...members.map((member) =>
      sendMail(
        memberVerificationMail({
          to: member.email,
          memberName: member.fullName,
          teamName: team.teamName,
          iglName: team.iglName,
          url: memberLink(member.token),
        })
      ).then((result) => ({ result, who: member.email }))
    ),
  ])

  return {
    sent: results.filter(({ result }) => result.ok).length,
    failed: results.filter(({ result }) => !result.ok).map(({ who }) => who),
  }
}
