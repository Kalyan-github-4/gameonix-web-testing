"use server"

import { OTP_MAX_ATTEMPTS, OTP_MAX_SENDS_PER_DAY } from "@/lib/tournament/constants"
import {
  confirmMemberDetails,
  isWindowClosed,
  loadMemberByToken,
  memberSubject,
  readOtpState,
  sendPhoneOtp,
  verifyPhoneOtp,
  type OtpState,
} from "@/lib/verification/service"

export type OtpActionResult = {
  ok: boolean
  message?: string
  state: OtpState
  devCode?: string
}

export type ConfirmActionResult = {
  ok: boolean
  message?: string
  fieldErrors: Record<string, string>
}

/** What the UI shows when the link is dead — no code can be sent against it. */
const CLOSED_STATE: OtpState = {
  challengeOpen: false,
  attemptsLeft: OTP_MAX_ATTEMPTS,
  resendAvailableAt: null,
  sendsRemaining: OTP_MAX_SENDS_PER_DAY,
}

const LINK_DEAD = "This link is no longer valid. Ask your IGL to send a new one."

export async function confirmDetailsAction(
  token: string,
  input: { fullName: string; phone: string; inGameId: string }
): Promise<ConfirmActionResult> {
  const context = await loadMemberByToken(token)

  if (!context || isWindowClosed(context.team)) {
    return { ok: false, message: LINK_DEAD, fieldErrors: {} }
  }
  if (context.team.status !== "awaiting_verification") {
    return {
      ok: false,
      message: "This roster has already been submitted and can no longer be edited.",
      fieldErrors: {},
    }
  }

  const result = await confirmMemberDetails(context, input)
  return result.ok
    ? { ok: true, fieldErrors: {} }
    : { ok: false, message: result.message, fieldErrors: result.fieldErrors }
}

export async function sendCodeAction(token: string): Promise<OtpActionResult> {
  const context = await loadMemberByToken(token)

  if (!context || isWindowClosed(context.team)) {
    return { ok: false, message: LINK_DEAD, state: CLOSED_STATE }
  }
  if (!context.member.emailVerifiedAt) {
    return {
      ok: false,
      message: "Confirm your details first.",
      state: await readOtpState(memberSubject(context.team, context.member)),
    }
  }
  if (context.member.phoneVerifiedAt) {
    return {
      ok: false,
      message: "This number is already verified.",
      state: await readOtpState(memberSubject(context.team, context.member)),
    }
  }

  return sendPhoneOtp(memberSubject(context.team, context.member))
}

export async function verifyCodeAction(
  token: string,
  code: string
): Promise<OtpActionResult> {
  const context = await loadMemberByToken(token)

  if (!context || isWindowClosed(context.team)) {
    return { ok: false, message: LINK_DEAD, state: CLOSED_STATE }
  }

  const subject = memberSubject(context.team, context.member)
  const result = await verifyPhoneOtp(subject, code)

  return result.ok
    ? { ok: true, state: await readOtpState(subject) }
    : { ok: false, message: result.message, state: result.state }
}
