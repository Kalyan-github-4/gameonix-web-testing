"use client"

import * as React from "react"
import { Loader2, MessageSquare } from "lucide-react"

import { StatusChip } from "@/components/verification/status-chip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OTP_LENGTH } from "@/lib/tournament/constants"
import type { OtpState } from "@/lib/verification/service"

export type OtpActionResult = {
  ok: boolean
  message?: string
  state: OtpState
  /** Development only — echoed back when no SMS provider is configured. */
  devCode?: string
}

/**
 * Whole seconds left until `iso`, recomputed on every tick. The interval only
 * nudges the component to re-render; the value itself is derived, so there is
 * no second copy of the countdown to fall out of sync.
 */
function useSecondsUntil(iso: string | null): number {
  const [, tick] = React.useState(0)

  React.useEffect(() => {
    if (!iso) return

    const timer = setInterval(() => {
      tick((n) => n + 1)
      if (remaining(iso) <= 0) clearInterval(timer)
    }, 1000)

    return () => clearInterval(timer)
  }, [iso])

  return remaining(iso)
}

function remaining(iso: string | null): number {
  if (!iso) return 0
  return Math.max(Math.ceil((new Date(iso).getTime() - Date.now()) / 1000), 0)
}

/**
 * One phone number, one code. Used unchanged by the player page and by the
 * IGL's own row on the hub — the flow is identical, only the row the timestamp
 * lands on differs.
 */
export function OtpPanel({
  id,
  destination,
  verified,
  initialState,
  disabled = false,
  disabledReason,
  onSend,
  onVerify,
}: {
  id: string
  destination: string
  verified: boolean
  initialState: OtpState
  disabled?: boolean
  disabledReason?: string
  onSend: () => Promise<OtpActionResult>
  onVerify: (code: string) => Promise<OtpActionResult>
}) {
  // Local state carries whatever the last action returned; a re-render from
  // the server is authoritative and resets it.
  const [state, setState] = React.useState(initialState)
  const [serverState, setServerState] = React.useState(initialState)
  const [code, setCode] = React.useState("")
  const [message, setMessage] = React.useState<string | null>(null)
  const [tone, setTone] = React.useState<"error" | "info">("info")
  const [devCode, setDevCode] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<"send" | "verify" | null>(null)
  const codeRef = React.useRef<HTMLInputElement>(null)

  if (initialState !== serverState) {
    setServerState(initialState)
    setState(initialState)
  }

  const cooldown = useSecondsUntil(state.resendAvailableAt)

  if (verified) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-600/30 bg-emerald-600/5 px-4 py-3">
        <StatusChip tone="verified">Phone verified</StatusChip>
        <span className="font-mono text-sm">{destination}</span>
      </div>
    )
  }

  async function run(kind: "send" | "verify") {
    setBusy(kind)
    setMessage(null)
    try {
      const result =
        kind === "send" ? await onSend() : await onVerify(code)

      setState(result.state)
      setTone(result.ok ? "info" : "error")

      if (kind === "send" && result.ok) {
        setMessage(`Code sent to ${destination}. It expires in 10 minutes.`)
        setDevCode(result.devCode ?? null)
        setCode("")
        codeRef.current?.focus()
      } else {
        setMessage(result.message ?? null)
      }

      if (kind === "verify" && !result.ok) setCode("")
    } catch {
      setTone("error")
      setMessage("Something went wrong. Try again.")
    } finally {
      setBusy(null)
    }
  }

  const canSend = !disabled && !busy && cooldown === 0 && state.sendsRemaining > 0
  const canVerify =
    !disabled && !busy && state.challengeOpen && code.length === OTP_LENGTH

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm">{destination}</span>
        <Button
          type="button"
          variant={state.challengeOpen ? "outline" : "default"}
          size="sm"
          disabled={!canSend}
          onClick={() => run("send")}
        >
          {busy === "send" ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <MessageSquare aria-hidden="true" />
          )}
          {state.challengeOpen ? "Resend code" : "Send OTP"}
        </Button>
        {cooldown > 0 ? (
          <span className="text-xs text-muted-foreground">
            Resend in {cooldown}s
          </span>
        ) : null}
      </div>

      {disabled && disabledReason ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}

      {state.challengeOpen ? (
        <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-4">
          <Label htmlFor={id}>Enter the {OTP_LENGTH}-digit code</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              id={id}
              ref={codeRef}
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              placeholder="––––––"
              aria-invalid={tone === "error" && !!message ? true : undefined}
              className="w-40 text-center font-mono text-lg tracking-[0.4em]"
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" && canVerify) {
                  event.preventDefault()
                  void run("verify")
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              disabled={!canVerify}
              onClick={() => run("verify")}
            >
              {busy === "verify" ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : null}
              Verify
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {state.attemptsLeft} attempt{state.attemptsLeft === 1 ? "" : "s"} left
          </p>
        </div>
      ) : null}

      {message ? (
        <p
          role="status"
          className={
            tone === "error"
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {message}
        </p>
      ) : null}

      {devCode ? (
        <p className="rounded-md border border-dashed border-amber-600/40 bg-amber-600/5 px-3 py-2 font-mono text-xs text-amber-700 dark:text-amber-400">
          Dev mode — no SMS provider configured. Your code is {devCode}
        </p>
      ) : null}

      {state.sendsRemaining === 0 && !state.challengeOpen ? (
        <p className="text-xs text-destructive">
          No codes left for today. Contact the organizers.
        </p>
      ) : null}
    </div>
  )
}
