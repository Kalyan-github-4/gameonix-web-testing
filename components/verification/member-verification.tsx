"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, Pencil } from "lucide-react"

import {
  confirmDetailsAction,
  sendCodeAction,
  verifyCodeAction,
} from "@/app/verify/[token]/actions"
import { Field, fieldProps } from "@/components/registration/field"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { OtpPanel } from "@/components/verification/otp-panel"
import { StatusChip } from "@/components/verification/status-chip"
import type { OtpState } from "@/lib/verification/service"

export type MemberView = {
  token: string
  teamName: string
  iglName: string
  position: number
  fullName: string
  email: string
  phone: string
  inGameId: string
  emailVerified: boolean
  phoneVerified: boolean
  otpState: OtpState
  locked: boolean
}

export function MemberVerification({ view }: { view: MemberView }) {
  const router = useRouter()

  const [details, setDetails] = React.useState({
    fullName: view.fullName,
    phone: view.phone,
    inGameId: view.inGameId,
  })
  const [editing, setEditing] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [message, setMessage] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const confirmed = view.emailVerified

  async function confirmDetails() {
    setSaving(true)
    setMessage(null)
    try {
      const result = await confirmDetailsAction(view.token, details)
      setErrors(result.fieldErrors)
      if (result.ok) {
        setEditing(false)
        router.refresh()
      } else {
        setMessage(result.message ?? null)
      }
    } finally {
      setSaving(false)
    }
  }

  if (view.phoneVerified && view.emailVerified) {
    return <VerifiedReceipt view={view} />
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Step 1 · Check your details</CardTitle>
          <CardDescription>
            {view.iglName} entered these when registering {view.teamName}. Fix
            anything that is wrong, then confirm.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Email address</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm break-all">{view.email}</span>
              {confirmed ? (
                <StatusChip tone="verified">Verified</StatusChip>
              ) : (
                <StatusChip tone="waiting">Confirm below</StatusChip>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              You are reading the email we sent here, so this address is proven
              once you confirm. To change it, ask {view.iglName} to update your
              roster row.
            </p>
          </div>

          {editing || !confirmed ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="member-fullName"
                label="Full name"
                error={errors.fullName}
                className="sm:col-span-2"
              >
                <Input
                  {...fieldProps("member-fullName", errors.fullName)}
                  value={details.fullName}
                  autoComplete="name"
                  onChange={(event) =>
                    setDetails((d) => ({ ...d, fullName: event.target.value }))
                  }
                />
              </Field>
              <Field id="member-phone" label="Phone number" error={errors.phone}>
                <Input
                  {...fieldProps("member-phone", errors.phone)}
                  value={details.phone}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  onChange={(event) =>
                    setDetails((d) => ({ ...d, phone: event.target.value }))
                  }
                />
              </Field>
              <Field
                id="member-inGameId"
                label="In-Game ID (IGN / UID)"
                error={errors.inGameId}
              >
                <Input
                  {...fieldProps("member-inGameId", errors.inGameId)}
                  value={details.inGameId}
                  autoComplete="off"
                  onChange={(event) =>
                    setDetails((d) => ({ ...d, inGameId: event.target.value }))
                  }
                />
              </Field>
            </div>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              <ReadOnly label="Full name" value={details.fullName} />
              <ReadOnly label="In-Game ID" value={details.inGameId} mono />
            </dl>
          )}

          {message ? (
            <p role="alert" className="text-xs text-destructive">
              {message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {confirmed && !editing ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={view.phoneVerified}
                onClick={() => setEditing(true)}
              >
                <Pencil aria-hidden="true" />
                Edit details
              </Button>
            ) : (
              <Button type="button" disabled={saving} onClick={confirmDetails}>
                {saving ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : null}
                {confirmed ? "Save changes" : "Confirm my details"}
              </Button>
            )}
            {confirmed && editing ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false)
                  setErrors({})
                  setDetails({
                    fullName: view.fullName,
                    phone: view.phone,
                    inGameId: view.inGameId,
                  })
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Step 2 · Verify your phone number
          </CardTitle>
          <CardDescription>
            We send a one-time code by SMS. This proves the number on the roster
            is really yours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OtpPanel
            id="member-otp"
            destination={view.phone}
            verified={view.phoneVerified}
            initialState={view.otpState}
            disabled={!confirmed}
            disabledReason="Confirm your details above first."
            onSend={async () => {
              const result = await sendCodeAction(view.token)
              router.refresh()
              return result
            }}
            onVerify={async (code) => {
              const result = await verifyCodeAction(view.token, code)
              router.refresh()
              return result
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function ReadOnly({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-sm" : "text-sm"}>{value}</dd>
    </div>
  )
}

function VerifiedReceipt({ view }: { view: MemberView }) {
  return (
    <Card>
      <CardContent className="grid gap-3 py-8 text-center">
        <CheckCircle2
          className="mx-auto size-9 text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        />
        <h2 className="text-lg font-semibold">You are verified</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Your spot on {view.teamName} is confirmed. {view.iglName} submits the
          final roster once everyone has done this — nothing else is needed from
          you.
        </p>
        <dl className="mx-auto mt-2 grid gap-2 text-left text-sm sm:grid-cols-2">
          <ReadOnly label="Player" value={view.fullName} />
          <ReadOnly label="In-Game ID" value={view.inGameId} mono />
          <ReadOnly label="Email" value={view.email} mono />
          <ReadOnly label="Phone" value={view.phone} mono />
        </dl>
      </CardContent>
    </Card>
  )
}
