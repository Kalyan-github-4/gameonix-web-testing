import type { Metadata } from "next"

import { TeamRegistrationForm } from "@/components/registration/team-registration-form"
import { MAX_TEAM_MEMBERS, MIN_TEAM_MEMBERS } from "@/lib/tournament/constants"

export const metadata: Metadata = {
  title: "Team registration | Gamonix",
  description:
    "Register your team for the tournament. The IGL submits the roster on behalf of the whole team.",
}

export default function RegisterPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 grid gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Gamonix Tournament
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Team registration
        </h1>
        <p className="text-sm text-muted-foreground">
          The In-Game Leader registers on behalf of the entire team: team
          details, the IGL&apos;s contact information, and every player on the
          roster ({MIN_TEAM_MEMBERS}–{MAX_TEAM_MEMBERS} members). Fields marked
          with <span className="text-destructive">*</span> are required.
        </p>
      </header>

      <TeamRegistrationForm />
    </main>
  )
}
