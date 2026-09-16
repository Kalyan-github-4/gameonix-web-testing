import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { IglHub, type HubView } from "@/components/verification/igl-hub"
import {
  iglSubject,
  isWindowClosed,
  loadHubByToken,
  readOtpState,
} from "@/lib/verification/service"

export const metadata: Metadata = {
  title: "Roster dashboard | Gamonix",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function HubPage({
  params,
}: PageProps<"/verify/team/[token]">) {
  const { token } = await params
  const context = await loadHubByToken(token)

  if (!context) notFound()

  const { team, members } = context

  if (isWindowClosed(team)) {
    return (
      <Shell teamName={team.teamName} logoUrl={team.logoUrl}>
        <Card>
          <CardContent className="grid gap-2 py-8 text-center">
            <h2 className="text-lg font-semibold">Verification has closed</h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              The window for {team.teamName} ended on{" "}
              {team.verificationExpiresAt.toLocaleDateString()}. Contact the
              organizers to have it reopened.
            </p>
          </CardContent>
        </Card>
      </Shell>
    )
  }

  const view: HubView = {
    token,
    teamName: team.teamName,
    iglName: team.iglName,
    iglEmail: team.iglEmail,
    iglPhone: team.iglPhone,
    iglInGameName: team.iglInGameName,
    iglInGameId: team.iglInGameId,
    iglEmailVerified: !!team.iglEmailVerifiedAt,
    iglPhoneVerified: !!team.iglPhoneVerifiedAt,
    otpState: await readOtpState(iglSubject(team)),
    deadline: team.verificationExpiresAt.toLocaleString(),
    submitted: team.status !== "awaiting_verification",
    members: members.map((member) => ({
      id: member.id,
      position: member.position,
      fullName: member.fullName,
      email: member.email,
      phone: member.phone,
      inGameName: member.inGameName,
      inGameId: member.inGameId,
      emailVerified: !!member.emailVerifiedAt,
      phoneVerified: !!member.phoneVerifiedAt,
    })),
  }

  return (
    <Shell teamName={team.teamName} logoUrl={team.logoUrl}>
      <IglHub view={view} />
    </Shell>
  )
}

function Shell({
  teamName,
  logoUrl,
  children,
}: {
  teamName: string
  logoUrl: string
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 flex items-center gap-3">
        <Image
          src={logoUrl}
          alt={`${teamName} logo`}
          width={48}
          height={48}
          unoptimized
          className="size-12 rounded-lg object-cover ring-1 ring-foreground/10"
        />
        <div className="grid gap-0.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Roster dashboard
          </p>
          <h1 className="text-xl font-semibold tracking-tight">{teamName}</h1>
        </div>
      </header>
      {children}
    </main>
  )
}
