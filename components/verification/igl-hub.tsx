"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, MailCheck, RefreshCw, Send, ShieldCheck } from "lucide-react"

import {
  confirmIglEmailAction,
  reissueLinkAction,
  sendIglCodeAction,
  submitRosterAction,
  verifyIglCodeAction,
} from "@/app/verify/team/[token]/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OtpPanel } from "@/components/verification/otp-panel"
import { StatusChip } from "@/components/verification/status-chip"
import type { OtpState } from "@/lib/verification/service"
import { cn } from "@/lib/utils"

export type HubMemberView = {
  id: string
  position: number
  fullName: string
  email: string
  phone: string
  inGameName: string
  inGameId: string
  emailVerified: boolean
  phoneVerified: boolean
}

export type HubView = {
  token: string
  teamName: string
  iglName: string
  iglEmail: string
  iglPhone: string
  iglInGameName: string
  iglInGameId: string
  iglEmailVerified: boolean
  iglPhoneVerified: boolean
  otpState: OtpState
  members: HubMemberView[]
  deadline: string
  submitted: boolean
}

export function IglHub({ view }: { view: HubView }) {
  const router = useRouter()
  const [banner, setBanner] = React.useState<{
    tone: "ok" | "error"
    text: string
  } | null>(null)
  const [busy, setBusy] = React.useState(false)

  const verifiedCount = view.members.filter(
    (member) => member.emailVerified && member.phoneVerified
  ).length
  const rosterReady =
    view.iglEmailVerified &&
    view.iglPhoneVerified &&
    view.members.length > 0 &&
    verifiedCount === view.members.length

  // Named so the IGL knows exactly who to chase, rather than just seeing a
  // disabled button.
  const outstanding = [
    ...(view.iglEmailVerified && view.iglPhoneVerified ? [] : ["you"]),
    ...view.members
      .filter((member) => !(member.emailVerified && member.phoneVerified))
      .map((member) => member.fullName),
  ]

  async function confirmEmail() {
    setBusy(true)
    try {
      const result = await confirmIglEmailAction(view.token)
      if (!result.ok) setBanner({ tone: "error", text: result.message ?? "" })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    setBusy(true)
    setBanner(null)
    try {
      const result = await submitRosterAction(view.token)
      setBanner({
        tone: result.ok ? "ok" : "error",
        text: result.ok
          ? "Roster submitted. Organizers will review it."
          : (result.message ?? "Could not submit."),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (view.submitted) {
    return (
      <Card>
        <CardContent className="grid gap-3 py-8 text-center">
          <ShieldCheck
            className="mx-auto size-9 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          <h2 className="text-lg font-semibold">Roster submitted</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {view.teamName} is with the organizers now, with every player
            verified. You will hear from them at {view.iglEmail}.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6">
      {banner ? (
        <div
          role="status"
          className={
            banner.tone === "ok"
              ? "rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400"
              : "rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          }
        >
          {banner.text}
        </div>
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Your details</CardTitle>
          <CardDescription>
            You are the accountable contact for {view.teamName}, so you verify
            the same way your players do.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-0.5">
            <span className="text-sm font-medium">In-Game Name</span>
            <span className="text-sm">{view.iglInGameName}</span>
          </div>

          <div className="grid gap-0.5">
            <span className="text-sm font-medium">In-Game ID</span>
            <span className="font-mono text-sm">{view.iglInGameId}</span>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Email address</span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm break-all">{view.iglEmail}</span>
              {view.iglEmailVerified ? (
                <StatusChip tone="verified">Verified</StatusChip>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={confirmEmail}
                >
                  {busy ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <MailCheck aria-hidden="true" />
                  )}
                  Confirm this is me
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Phone number</span>
            <OtpPanel
              id="igl-otp"
              destination={view.iglPhone}
              verified={view.iglPhoneVerified}
              initialState={view.otpState}
              disabled={!view.iglEmailVerified}
              disabledReason="Confirm your email address first."
              onSend={async () => {
                const result = await sendIglCodeAction(view.token)
                router.refresh()
                return result
              }}
              onVerify={async (code) => {
                const result = await verifyIglCodeAction(view.token, code)
                router.refresh()
                return result
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Roster
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {verifiedCount} of {view.members.length} player
              {view.members.length === 1 ? "" : "s"} verified
            </span>
          </CardTitle>
          <CardDescription>
            Each player was emailed their own link. They confirm their details,
            then verify their phone by SMS.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {view.members.map((member) => (
            <MemberRow
              key={member.id}
              token={view.token}
              member={member}
              onDone={(text, tone) => {
                setBanner({ tone, text })
                router.refresh()
              }}
            />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        {outstanding.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Still waiting on{" "}
            <span className="font-medium text-foreground">
              {formatList(outstanding)}
            </span>
            . The roster can only be submitted once everyone is verified —
            verification closes {view.deadline}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Everyone is verified. Submitting sends {view.teamName} to the
            organizers and locks the roster — no further edits after this.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="lg"
            disabled={!rosterReady || busy}
            onClick={submit}
          >
            {busy ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            Submit roster
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => router.refresh()}
          >
            <RefreshCw aria-hidden="true" />
            Refresh status
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * One labelled value. `verified` is only passed for the two fields that are
 * actually proven — leaving the In-Game ID without a sign, because nothing
 * verifies it.
 */
function Detail({
  label,
  value,
  verified,
  className,
}: {
  label: string
  value: string
  verified?: boolean
  className?: string
}) {
  return (
    <div className={cn("grid gap-0.5", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm break-all">{value}</span>
        {verified === undefined ? null : (
          <StatusChip tone={verified ? "verified" : "waiting"}>
            {verified ? "Verified" : "Pending"}
          </StatusChip>
        )}
      </dd>
    </div>
  )
}

/** "you", "you and Arjun", "you, Arjun and Priya" */
function formatList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

function MemberRow({
  token,
  member,
  onDone,
}: {
  token: string
  member: HubMemberView
  onDone: (text: string, tone: "ok" | "error") => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [email, setEmail] = React.useState(member.email)
  const [busy, setBusy] = React.useState(false)

  const done = member.emailVerified && member.phoneVerified

  async function reissue(newEmail?: string) {
    setBusy(true)
    try {
      const result = await reissueLinkAction(token, member.id, newEmail)
      onDone(result.message ?? "", result.ok ? "ok" : "error")
      if (result.ok) setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs text-muted-foreground">#{member.position}</span>
        <span className="text-sm font-medium">{member.fullName}</span>
        <StatusChip
          tone={done ? "verified" : "waiting"}
          className="ml-auto"
        >
          {done ? "Verified" : "Not verified"}
        </StatusChip>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Detail label="In-Game Name" value={member.inGameName} />
        <Detail label="In-Game ID" value={member.inGameId} />
        <Detail
          label="Phone"
          value={member.phone}
          verified={member.phoneVerified}
        />
        <Detail
          label="Email"
          value={member.email}
          verified={member.emailVerified}
          className="sm:col-span-2"
        />
      </dl>

      {editing ? (
        <div className="grid gap-2">
          <Label htmlFor={`email-${member.id}`}>Corrected email address</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={`email-${member.id}`}
              value={email}
              type="email"
              className="max-w-xs"
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => reissue(email)}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Save &amp; send
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false)
                setEmail(member.email)
              }}
            >
              Cancel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Sending a new link immediately kills the old one.
          </p>
        </div>
      ) : done ? null : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => reissue()}
          >
            {busy ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Send aria-hidden="true" />
            )}
            Resend link
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
          >
            Wrong email?
          </Button>
        </div>
      )}
    </div>
  )
}
