import type { Metadata } from "next"
import Image from "next/image"
import { asc, desc, inArray } from "drizzle-orm"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { db } from "@/lib/db"
import { teamMembers, teams } from "@/lib/db/schema"

export const metadata: Metadata = {
  title: "Registrations | Gamonix",
}

// Organizers always need the latest submissions.
export const dynamic = "force-dynamic"

export default async function RegistrationsPage() {
  const allTeams = await db.select().from(teams).orderBy(desc(teams.createdAt))

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

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Team registrations
        </h1>
        <p className="text-sm text-muted-foreground">
          {registrations.length} team{registrations.length === 1 ? "" : "s"}{" "}
          registered.
        </p>
      </header>

      {registrations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No teams have registered yet.
        </p>
      ) : (
        <div className="grid gap-5">
          {registrations.map(({ team, members }) => (
            <Card key={team.id}>
              <CardHeader className="border-b">
                <div className="flex items-center gap-3">
                  <Image
                    src={team.logoUrl}
                    alt={`${team.teamName} logo`}
                    width={48}
                    height={48}
                    unoptimized
                    className="size-12 rounded-lg object-cover ring-1 ring-foreground/10"
                  />
                  <div className="grid gap-0.5">
                    <CardTitle className="text-base">{team.teamName}</CardTitle>
                    <CardDescription>
                      IGL {team.iglName} · {team.iglPhone} · {team.iglEmail}
                    </CardDescription>
                  </div>
                  <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                    {team.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1.5 pr-4 font-medium">#</th>
                      <th className="py-1.5 pr-4 font-medium">Player</th>
                      <th className="py-1.5 pr-4 font-medium">In-Game ID</th>
                      <th className="py-1.5 pr-4 font-medium">Phone</th>
                      <th className="py-1.5 font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className="border-t border-border">
                        <td className="py-2 pr-4 text-muted-foreground">
                          {member.position}
                        </td>
                        <td className="py-2 pr-4">{member.fullName}</td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {member.inGameId}
                        </td>
                        <td className="py-2 pr-4">{member.phone}</td>
                        <td className="py-2">{member.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
