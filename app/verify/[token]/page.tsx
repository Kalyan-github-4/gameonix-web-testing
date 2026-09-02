import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"

import {
  MemberVerification,
  type MemberView,
} from "@/components/verification/member-verification"
import { Card, CardContent } from "@/components/ui/card"
import {
  isWindowClosed,
  loadMemberByToken,
  memberSubject,
  readOtpState,
} from "@/lib/verification/service"

export const metadata: Metadata = {
  title: "Verify your roster spot | Gamonix",
  // A verification link must never end up in a search index.
  robots: { index: false, follow: false },
}

// Verification state changes by the second; never serve a cached copy.
export const dynamic = "force-dynamic"

export default async function MemberVerificationPage({
  params,
}: PageProps<"/verify/[token]">) {
  const { token } = await params
  const context = await loadMemberByToken(token)

  if (!context) notFound()

  const { team, member } = context

  if (isWindowClosed(team)) {
    return (
      <Shell teamName={team.teamName} logoUrl={team.logoUrl}>
        <Notice
          title="This link has expired"
          body={`Verification for ${team.teamName} closed on ${team.verificationExpiresAt.toLocaleDateString()}. Ask ${team.iglName} to contact the organizers.`}
        />
      </Shell>
    )
  }

  if (team.status !== "awaiting_verification") {
    return (
      <Shell teamName={team.teamName} logoUrl={team.logoUrl}>
        <Notice
          title="Roster already submitted"
          body={`${team.iglName} has submitted the final roster for ${team.teamName}, so it can no longer be edited here.`}
        />
      </Shell>
    )
  }

  const view: MemberView = {
    token,
    teamName: team.teamName,
    iglName: team.iglName,
    position: member.position,
    fullName: member.fullName,
    email: member.email,
    phone: member.phone,
    inGameId: member.inGameId,
    emailVerified: !!member.emailVerifiedAt,
    phoneVerified: !!member.phoneVerifiedAt,
    otpState: await readOtpState(memberSubject(team, member)),
    locked: false,
  }

  return (
    <Shell teamName={team.teamName} logoUrl={team.logoUrl}>
      <MemberVerification view={view} />
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
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
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
            Gamonix Tournament
          </p>
          <h1 className="text-xl font-semibold tracking-tight">{teamName}</h1>
        </div>
      </header>
      {children}
    </main>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="grid gap-2 py-8 text-center">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  )
}
