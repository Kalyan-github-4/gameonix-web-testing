import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <main className="grid w-full max-w-xl gap-5 text-center">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Gamonix Tournament
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Register your squad
        </h1>
        <p className="text-sm text-muted-foreground">
          The In-Game Leader submits the team name, logo, their own contact
          details and the full roster in a single form.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" render={<Link href="/register" />}>
            Register a team
          </Button>
          <Button
            size="lg"
            variant="outline"
            render={<Link href="/admin/registrations" />}
          >
            Organizer view
          </Button>
        </div>
      </main>
    </div>
  )
}
