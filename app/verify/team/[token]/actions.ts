"use server"

import { revalidatePath } from "next/cache"

import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_DAY,
} from "@/lib/tournament/constants"
import {
  confirmIglEmail,
  iglSubject,
  isWindowClosed,
  loadHubByToken,
  readOtpState,
  reissueMemberLink,
  sendPhoneOtp,
  submitRoster,
  verifyPhoneOtp,
  type OtpState,
} from "@/lib/verification/service"

export type OtpActionResult = {
  ok: boolean
  message?: string
  state: OtpState
  devCode?: string
}

export type SimpleActionResult = { ok: boolean; message?: string }

const CLOSED_STATE: OtpState = {
  challengeOpen: false,
  attemptsLeft: OTP_MAX_ATTEMPTS,
  resendAvailableAt: null,
  sendsRemaining: OTP_MAX_SENDS_PER_DAY,
}

const LINK_DEAD = "This dashboard link is no longer valid."

export async function confirmIglEmailAction(
  token: string
): Promise<SimpleActionResult> {
  const context = await loadHubByToken(token)
  if (!context || isWindowClosed(context.team)) {
    return { ok: false, message: LINK_DEAD }
  }

  await confirmIglEmail(context.team)
  return { ok: true }
}

export async function sendIglCodeAction(token: string): Promise<OtpActionResult> {
  const context = await loadHubByToken(token)

  if (!context || isWindowClosed(context.team)) {
    return { ok: false, message: LINK_DEAD, state: CLOSED_STATE }
  }
  if (context.team.iglPhoneVerifiedAt) {
    return {
      ok: false,
      message: "Your number is already verified.",
      state: await readOtpState(iglSubject(context.team)),
    }
  }

  return sendPhoneOtp(iglSubject(context.team))
}

export async function verifyIglCodeAction(
  token: string,
  code: string
): Promise<OtpActionResult> {
  const context = await loadHubByToken(token)

  if (!context || isWindowClosed(context.team)) {
    return { ok: false, message: LINK_DEAD, state: CLOSED_STATE }
  }

  const subject = iglSubject(context.team)
  const result = await verifyPhoneOtp(subject, code)

  return result.ok
    ? { ok: true, state: await readOtpState(subject) }
    : { ok: false, message: result.message, state: result.state }
}

/**
 * Re-sends a player's link, optionally to a corrected address. This is the
 * only way a mistyped email gets fixed — the player never received anything,
 * so they cannot fix it themselves.
 */
export async function reissueLinkAction(
  token: string,
  memberId: string,
  newEmail?: string
): Promise<SimpleActionResult> {
  const context = await loadHubByToken(token)
  if (!context) return { ok: false, message: LINK_DEAD }

  const member = context.members.find((row) => row.id === memberId)
  if (!member) return { ok: false, message: "That player is not on this roster." }

  const result = await reissueMemberLink({
    team: context.team,
    member,
    newEmail,
  })

  if (!result.ok) return result

  return {
    ok: true,
    message: result.emailChanged
      ? "Address updated and a fresh link sent. The old link no longer works."
      : "Link sent again.",
  }
}

export async function submitRosterAction(
  token: string
): Promise<SimpleActionResult> {
  const context = await loadHubByToken(token)
  if (!context) return { ok: false, message: LINK_DEAD }

  const result = await submitRoster(context)
  if (result.ok) revalidatePath("/admin/registrations")

  return result
}
