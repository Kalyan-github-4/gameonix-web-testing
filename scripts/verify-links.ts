/**
 * Prints working verification links for the most recent registration, without
 * sending any email.
 *
 * Useful while Resend is still on `onboarding@resend.dev`, which only delivers
 * to the account owner's own address — the second test inbox never receives
 * anything. Every run mints fresh tokens, so any link printed earlier stops
 * working.
 *
 *   npx tsx scripts/verify-links.ts
 */
import "dotenv/config"
import { desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { teamMembers, teams } from "@/lib/db/schema"
import {
  hubLink,
  memberLink,
  mintVerificationToken,
} from "@/lib/verification/service"

async function main() {
  const [team] = await db
    .select()
    .from(teams)
    .orderBy(desc(teams.createdAt))
    .limit(1)

  if (!team) {
    console.log("No registrations yet — submit the form at /register first.")
    return
  }

  const hubToken = mintVerificationToken()
  await db
    .update(teams)
    .set({ hubTokenHash: hubToken.hash })
    .where(eq(teams.id, team.id))

  const members = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.teamId, team.id))
    .orderBy(teamMembers.position)

  console.log(`\n${team.teamName}  ·  status: ${team.status}\n`)
  console.log(`IGL   ${team.iglName} <${team.iglEmail}>`)
  console.log(`      ${hubLink(hubToken.token)}\n`)

  for (const member of members) {
    const token = mintVerificationToken()
    await db
      .update(teamMembers)
      .set({ verifyTokenHash: token.hash })
      .where(eq(teamMembers.id, member.id))

    const state = [
      member.emailVerifiedAt ? "email ✓" : "email —",
      member.phoneVerifiedAt ? "phone ✓" : "phone —",
    ].join("  ")

    console.log(`#${member.position}    ${member.fullName} <${member.email}>  ${state}`)
    console.log(`      ${memberLink(token.token)}\n`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
