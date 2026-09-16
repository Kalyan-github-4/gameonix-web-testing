/**
 * End-to-end exercise of the verification service against the real database,
 * with no HTTP and no outbound mail. Creates a throwaway team, walks it from
 * `awaiting_verification` to `pending`, then deletes it.
 *
 *   npx tsx scripts/verify-smoke.ts
 */
import "dotenv/config"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { teamMembers, teams } from "@/lib/db/schema"
import {
  confirmIglEmail,
  confirmMemberDetails,
  iglSubject,
  loadHubByToken,
  loadMemberByToken,
  memberSubject,
  mintVerificationToken,
  sendPhoneOtp,
  submitRoster,
  verificationDeadline,
  verifyPhoneOtp,
} from "@/lib/verification/service"

const stamp = Date.now().toString().slice(-6)

function check(label: string, condition: boolean) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`)
  if (!condition) process.exitCode = 1
}

async function main() {
  const hubToken = mintVerificationToken()
  const memberToken = mintVerificationToken()

  const [team] = await db
    .insert(teams)
    .values({
      teamName: `Smoke Test ${stamp}`,
      logoUrl: "/uploads/team-logos/smoke.png",
      logoMimeType: "image/png",
      logoSizeBytes: 1,
      iglName: "Smoke Igl",
      iglPhone: `+9198${stamp}0${stamp.slice(0, 1)}`.slice(0, 13),
      iglEmail: `igl.${stamp}@example.com`,
      iglInGameName: `Smoke IGL ${stamp}`,
      iglInGameId: `smokeigl${stamp}`,
      hubTokenHash: hubToken.hash,
      verificationExpiresAt: verificationDeadline(),
    })
    .returning()

  await db.insert(teamMembers).values({
    teamId: team.id,
    fullName: "Smoke Player",
    phone: `+9197${stamp}0${stamp.slice(0, 1)}`.slice(0, 13),
    email: `player.${stamp}@example.com`,
    inGameName: `Smoke Player ${stamp}`,
    inGameId: `smoke${stamp}`,
    position: 1,
    verifyTokenHash: memberToken.hash,
  })

  try {
    /* ---------------------------------------------------------- player -- */
    const context = await loadMemberByToken(memberToken.token)
    check("member link resolves", !!context)
    if (!context) return

    check("email starts unverified", !context.member.emailVerifiedAt)

    const confirmed = await confirmMemberDetails(context, {
      fullName: "Smoke Player",
      phone: context.member.phone,
      inGameName: context.member.inGameName,
      inGameId: context.member.inGameId,
    })
    check("player confirms details", confirmed.ok)

    const afterConfirm = await loadMemberByToken(memberToken.token)
    check("confirming stamps the email", !!afterConfirm?.member.emailVerifiedAt)
    if (!afterConfirm) return

    const subject = memberSubject(afterConfirm.team, afterConfirm.member)

    const send = await sendPhoneOtp(subject)
    check("OTP dispatches", send.ok)
    if (!send.ok) return
    check("dev transport echoes the code", !!send.devCode)

    const wrong = await verifyPhoneOtp(subject, "000000")
    check(
      "a wrong code is rejected and burns an attempt",
      !wrong.ok && wrong.state.attemptsLeft === 4
    )

    const right = await verifyPhoneOtp(subject, send.devCode!)
    check("the real code verifies", right.ok)

    const replay = await verifyPhoneOtp(subject, send.devCode!)
    check("the same code cannot be replayed", !replay.ok)

    /* ------------------------------------------------------------- IGL -- */
    let hub = await loadHubByToken(hubToken.token)
    check("hub link resolves", !!hub)
    if (!hub) return

    const early = await submitRoster(hub)
    check("cannot submit before the IGL verifies", !early.ok)

    await confirmIglEmail(hub.team)
    hub = (await loadHubByToken(hubToken.token))!

    const iglSend = await sendPhoneOtp(iglSubject(hub.team))
    check("IGL OTP dispatches", iglSend.ok)
    if (!iglSend.ok) return

    const iglVerify = await verifyPhoneOtp(
      iglSubject(hub.team),
      iglSend.devCode!
    )
    check("IGL code verifies", iglVerify.ok)

    /* ---------------------------------------------------------- submit -- */
    hub = (await loadHubByToken(hubToken.token))!
    const submitted = await submitRoster(hub)
    check("roster submits once everyone is green", submitted.ok)

    const [final] = await db.select().from(teams).where(eq(teams.id, team.id))
    check("status moves to pending", final.status === "pending")

    const twice = await submitRoster((await loadHubByToken(hubToken.token))!)
    check("submitting twice is refused", !twice.ok)
  } finally {
    await db.delete(teams).where(eq(teams.id, team.id))
    console.log("\ncleaned up throwaway team")
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
