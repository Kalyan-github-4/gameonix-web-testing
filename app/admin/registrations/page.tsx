import type { Metadata } from "next"
import Image from "next/image"
import { asc, desc, inArray, sql } from "drizzle-orm"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StatusChip } from "@/components/verification/status-chip"
import { db } from "@/lib/db"
import { teamMembers, teams } from "@/lib/db/schema"

export const metadata: Metadata = {
  title: "Registrations | Gamonix",
}

// Organizers always need the latest submissions.
export const dynamic = "force-dynamic"

const STATUS_LABELS: Record<string, string> = {
  awaiting_verification: "Awaiting verification",
  pending: "Ready for review",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
}

export default async function RegistrationsPage() {
  const allTeams = await db
    .select()
    .from(teams)
    // Rosters that cleared verification come first — they are the only ones
    // that need an organizer decision.
    .orderBy(
      sql`case when ${teams.status} = 'pending' then 0 else 1 end`,
      desc(teams.createdAt)
    )

  const allMembers = allTeams.length
    ? await db
        .select()
        .from(teamMembers)
        .where(
          inArray(
            teamMembers.teamId,
            allTeams.map((team) => team.id)
          )
        )
        .orderBy(asc(teamMembers.position))
    : []

  const registrations = allTeams.map((team) => ({
    team,
    members: allMembers.filter((member) => member.teamId === team.id),
  }))

  const readyCount = registrations.filter(
    ({ team }) => team.status === "pending"
  ).length

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Team registrations
        </h1>
        <p className="text-sm text-muted-foreground">
          {registrations.length} team{registrations.length === 1 ? "" : "s"}{" "}
          registered · {readyCount} fully verified and ready for review.
        </p>
      </header>

      {registrations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No teams have registered yet.
        </p>
      ) : (
        <div className="grid gap-5">
          {registrations.map(({ team, members }) => {
            const verified = members.filter(
              (member) => member.emailVerifiedAt && member.phoneVerifiedAt
            ).length

            return (
              <Card key={team.id}>
                <CardHeader className="border-b">
                  <div className="flex flex-wrap items-center gap-3">
                    <Image
                      src={team.logoUrl}
                      alt={`${team.teamName} logo`}
                      width={48}
                      height={48}
                      unoptimized
                      className="size-12 rounded-lg object-cover ring-1 ring-foreground/10"
                    />
                    <div className="grid gap-0.5">
                      <CardTitle className="text-base">
                        {team.teamName}
                      </CardTitle>
                      <CardDescription>
                        IGL {team.iglName} · {team.iglInGameName} ·{" "}
                        {team.iglInGameId} ·{" "}
                        {team.iglPhone} · {team.iglEmail}
                      </CardDescription>
                    </div>
                    <span className="ml-auto flex flex-wrap items-center gap-1.5">
                      <StatusChip
                        tone={team.iglEmailVerifiedAt ? "verified" : "waiting"}
                      >
                        IGL email
                      </StatusChip>
                      <StatusChip
                        tone={team.iglPhoneVerifiedAt ? "verified" : "waiting"}
                      >
                        IGL phone
                      </StatusChip>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                        {STATUS_LABELS[team.status] ?? team.status}
                      </span>
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <p className="text-xs text-muted-foreground">
                    {verified} of {members.length} player
                    {members.length === 1 ? "" : "s"} verified
                    {team.rosterSubmittedAt
                      ? ` · roster submitted ${team.rosterSubmittedAt.toLocaleString()}`
                      : ` · verification closes ${team.verificationExpiresAt.toLocaleString()}`}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr>
                          <th className="py-1.5 pr-4 font-medium">#</th>
                          <th className="py-1.5 pr-4 font-medium">Player</th>
                          <th className="py-1.5 pr-4 font-medium">
                            In-Game Name
                          </th>
                          <th className="py-1.5 pr-4 font-medium">In-Game ID</th>
                          <th className="py-1.5 pr-4 font-medium">Phone</th>
                          <th className="py-1.5 pr-4 font-medium">Email</th>
                          <th className="py-1.5 font-medium">Verified</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member) => (
                          <tr
                            key={member.id}
                            className="border-t border-border"
                          >
                            <td className="py-2 pr-4 text-muted-foreground">
                              {member.position}
                            </td>
                            <td className="py-2 pr-4">{member.fullName}</td>
                            <td className="py-2 pr-4">{member.inGameName}</td>
                            <td className="py-2 pr-4 font-mono text-xs">
                              {member.inGameId}
                            </td>
                            <td className="py-2 pr-4">{member.phone}</td>
                            <td className="py-2 pr-4">{member.email}</td>
                            <td className="py-2">
                              <span className="flex flex-wrap gap-1.5">
                                <StatusChip
                                  tone={
                                    member.emailVerifiedAt
                                      ? "verified"
                                      : "waiting"
                                  }
                                >
                                  Email
                                </StatusChip>
                                <StatusChip
                                  tone={
                                    member.phoneVerifiedAt
                                      ? "verified"
                                      : "waiting"
                                  }
                                >
                                  Phone
                                </StatusChip>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}
