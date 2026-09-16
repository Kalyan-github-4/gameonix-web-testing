"use client"

import * as React from "react"
import Image from "next/image"
import { ImageUp, MailCheck, Plus, Trash2, Users } from "lucide-react"

import { registerTeam } from "@/app/register/actions"
import {
  initialRegistrationState,
  type RegistrationState,
} from "@/app/register/registration-state"
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
import { Label } from "@/components/ui/label"
import {
  LOGO_ACCEPT_ATTRIBUTE,
  MAX_LOGO_BYTES,
  MAX_TEAM_MEMBERS,
  MIN_TEAM_MEMBERS,
  ROSTER_SIZE_LABEL,
} from "@/lib/tournament/constants"
import { logoSchema, registrationSchema } from "@/lib/tournament/validation"
import { cn } from "@/lib/utils"

type MemberRow = { key: string }

const MEMBER_FIELDS = [
  {
    name: "fullName",
    label: "Full name",
    type: "text",
    placeholder: "Arjun Mehta",
    autoComplete: "name",
  },
  {
    name: "phone",
    label: "Phone number",
    type: "tel",
    placeholder: "+91 98765 43210",
    autoComplete: "tel",
  },
  {
    name: "email",
    label: "Email address",
    type: "email",
    placeholder: "player@example.com",
    autoComplete: "email",
  },
  {
    name: "inGameName",
    label: "In-Game Name",
    type: "text",
    placeholder: "PhantomArjun",
    autoComplete: "off",
  },
  {
    name: "inGameId",
    label: "In-Game ID (UID)",
    type: "text",
    placeholder: "5182930471",
    autoComplete: "off",
  },
] as const

function newRow(): MemberRow {
  return { key: crypto.randomUUID() }
}

export function TeamRegistrationForm() {
  const [state, formAction, pending] = React.useActionState(
    registerTeam,
    initialRegistrationState
  )
  const [rows, setRows] = React.useState<MemberRow[]>(() =>
    Array.from({ length: MIN_TEAM_MEMBERS }, newRow)
  )
  const [clientErrors, setClientErrors] = React.useState<Record<string, string>>(
    {}
  )
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null)
  const [logoName, setLogoName] = React.useState<string | null>(null)
  const formRef = React.useRef<HTMLFormElement>(null)

  // Client-side issues take precedence: they reflect the latest edit.
  const errors: Record<string, string> = {
    ...state.fieldErrors,
    ...clientErrors,
  }

  React.useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview)
    }
  }, [logoPreview])

  // After a submit attempt, move focus to the first invalid field once the
  // errors (client-side or from the server) have rendered.
  const focusOnErrorRef = React.useRef(false)
  React.useEffect(() => {
    if (!focusOnErrorRef.current) return
    focusOnErrorRef.current = false
    const target = formRef.current?.querySelector<HTMLElement>(
      "[aria-invalid='true']"
    )
    target?.scrollIntoView({ behavior: "smooth", block: "center" })
    target?.focus({ preventScroll: true })
  }, [clientErrors, state])

  if (state.status === "success" && state.team) {
    return <SuccessPanel state={state} />
  }

  function collect(formData: FormData) {
    return {
      teamName: String(formData.get("teamName") ?? ""),
      iglName: String(formData.get("iglName") ?? ""),
      iglPhone: String(formData.get("iglPhone") ?? ""),
      iglEmail: String(formData.get("iglEmail") ?? ""),
      iglInGameName: String(formData.get("iglInGameName") ?? ""),
      iglInGameId: String(formData.get("iglInGameId") ?? ""),
      members: rows.map((_, index) => ({
        fullName: String(formData.get(`members[${index}].fullName`) ?? ""),
        phone: String(formData.get(`members[${index}].phone`) ?? ""),
        email: String(formData.get(`members[${index}].email`) ?? ""),
        inGameName: String(formData.get(`members[${index}].inGameName`) ?? ""),
        inGameId: String(formData.get(`members[${index}].inGameId`) ?? ""),
      })),
    }
  }

  /** Mirrors the server rules so the IGL gets feedback without a roundtrip. */
  function validate(formData: FormData) {
    const found: Record<string, string> = {}

    const parsed = registrationSchema.safeParse(collect(formData))
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".")
        if (!(key in found)) found[key] = issue.message
      }
    }

    const logo = logoSchema.safeParse(formData.get("logo"))
    if (!logo.success) {
      found.logo = logo.error.issues[0]?.message ?? "Invalid team logo"
    }

    return found
  }

  /**
   * Submits through `onSubmit` rather than `<form action>`: React resets every
   * uncontrolled field once a form action settles, which would wipe the whole
   * roster whenever a single field was rejected.
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const found = validate(formData)
    setClientErrors(found)
    focusOnErrorRef.current = true

    if (Object.keys(found).length > 0) return

    React.startTransition(() => formAction(formData))
  }

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (logoPreview) URL.revokeObjectURL(logoPreview)

    if (!file) {
      setLogoPreview(null)
      setLogoName(null)
      return
    }

    setLogoName(file.name)
    const result = logoSchema.safeParse(file)
    setClientErrors((previous) => {
      const next = { ...previous }
      if (result.success) {
        delete next.logo
      } else {
        next.logo = result.error.issues[0]?.message ?? "Invalid team logo"
      }
      return next
    })
    setLogoPreview(result.success ? URL.createObjectURL(file) : null)
  }

  function clearError(key: string) {
    setClientErrors((previous) => {
      if (!(key in previous)) return previous
      const next = { ...previous }
      delete next[key]
      return next
    })
  }

  function addMember() {
    setRows((previous) =>
      previous.length >= MAX_TEAM_MEMBERS ? previous : [...previous, newRow()]
    )
  }

  function removeMember(index: number) {
    if (rows.length <= MIN_TEAM_MEMBERS) return
    setRows((previous) => previous.filter((_, i) => i !== index))
    // Shift member-scoped errors so they stay attached to the right rows.
    setClientErrors((previous) => reindexMemberErrors(previous, index))
  }

  const rosterError = errors.members

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-6"
    >
      <input type="hidden" name="memberCount" value={rows.length} />

      {state.status === "error" ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.message}
        </div>
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Team details</CardTitle>
          <CardDescription>
            The team name and logo shown on brackets and broadcasts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field id="teamName" label="Team name" error={errors.teamName}>
            <Input
              {...fieldProps("teamName", errors.teamName)}
              name="teamName"
              placeholder="Team Phantom"
              maxLength={50}
              onChange={() => clearError("teamName")}
            />
          </Field>

          <div className="grid content-start gap-1.5">
            <Label htmlFor="logo">
              Team logo
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <div className="flex items-center gap-4">
              <label
                htmlFor="logo"
                className={cn(
                  "flex size-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-muted/40 transition-colors hover:border-ring hover:bg-muted",
                  errors.logo && "border-destructive"
                )}
              >
                {logoPreview ? (
                  <Image
                    src={logoPreview}
                    alt="Team logo preview"
                    width={80}
                    height={80}
                    unoptimized
                    className="size-20 object-cover"
                  />
                ) : (
                  <ImageUp
                    className="size-6 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
              </label>
              <div className="grid flex-1 gap-1.5">
                <Input
                  {...fieldProps("logo", errors.logo)}
                  type="file"
                  name="logo"
                  accept={LOGO_ACCEPT_ATTRIBUTE}
                  onChange={handleLogoChange}
                  className="h-auto cursor-pointer py-1.5 file:cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  PNG, JPEG or WebP · up to{" "}
                  {Math.round(MAX_LOGO_BYTES / (1024 * 1024))} MB
                  {logoName ? ` · ${logoName}` : ""}
                </p>
              </div>
            </div>
            {errors.logo ? (
              <p id="logo-error" className="text-xs text-destructive">
                {errors.logo}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">IGL details</CardTitle>
          <CardDescription>
            You are submitting on behalf of the team. Organizers use these
            details for all tournament communication.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field id="iglName" label="IGL name" error={errors.iglName}>
            <Input
              {...fieldProps("iglName", errors.iglName)}
              name="iglName"
              autoComplete="name"
              placeholder="Rohan Verma"
              onChange={() => clearError("iglName")}
            />
          </Field>
          <Field
            id="iglInGameName"
            label="IGL In-Game Name"
            error={errors.iglInGameName}
          >
            <Input
              {...fieldProps("iglInGameName", errors.iglInGameName)}
              name="iglInGameName"
              autoComplete="off"
              placeholder="PhantomRohan"
              onChange={() => clearError("iglInGameName")}
            />
          </Field>
          <Field
            id="iglInGameId"
            label="IGL In-Game ID (UID)"
            error={errors.iglInGameId}
          >
            <Input
              {...fieldProps("iglInGameId", errors.iglInGameId)}
              name="iglInGameId"
              autoComplete="off"
              placeholder="5182930471"
              onChange={() => clearError("iglInGameId")}
            />
          </Field>
          <Field id="iglPhone" label="IGL phone number" error={errors.iglPhone}>
            <Input
              {...fieldProps("iglPhone", errors.iglPhone)}
              name="iglPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              onChange={() => clearError("iglPhone")}
            />
          </Field>
          <Field id="iglEmail" label="IGL email address" error={errors.iglEmail}>
            <Input
              {...fieldProps("iglEmail", errors.iglEmail)}
              name="iglEmail"
              type="email"
              autoComplete="email"
              placeholder="igl@example.com"
              onChange={() => clearError("iglEmail")}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" aria-hidden="true" />
            Team members
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {rows.length} of {MAX_TEAM_MEMBERS}
            </span>
          </CardTitle>
          <CardDescription>
            Add every player on the roster ({ROSTER_SIZE_LABEL}). Each player
            needs a unique phone number, email and In-Game ID — they are emailed
            a verification link at the address you enter here, so double-check
            the spelling.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {rosterError ? (
            <p className="text-xs text-destructive">{rosterError}</p>
          ) : null}

          {rows.map((row, index) => (
            <fieldset
              key={row.key}
              className="grid gap-4 rounded-lg border border-border p-4"
            >
              <legend className="flex w-full items-center gap-2 px-1 text-sm font-medium">
                Member {index + 1}
                {rows.length > MIN_TEAM_MEMBERS ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="xs"
                    className="ml-auto"
                    onClick={() => removeMember(index)}
                  >
                    <Trash2 aria-hidden="true" />
                    Remove
                  </Button>
                ) : null}
              </legend>

              <div className="grid gap-4 sm:grid-cols-2">
                {MEMBER_FIELDS.map((field) => {
                  const path = `members.${index}.${field.name}`
                  const id = `member-${index}-${field.name}`
                  return (
                    <Field
                      key={field.name}
                      id={id}
                      label={field.label}
                      error={errors[path]}
                    >
                      <Input
                        {...fieldProps(id, errors[path])}
                        name={`members[${index}].${field.name}`}
                        type={field.type}
                        autoComplete={field.autoComplete}
                        placeholder={field.placeholder}
                        onChange={() => clearError(path)}
                      />
                    </Field>
                  )
                })}
              </div>
            </fieldset>
          ))}

          <div>
            <Button
              type="button"
              variant="outline"
              onClick={addMember}
              disabled={rows.length >= MAX_TEAM_MEMBERS}
            >
              <Plus aria-hidden="true" />
              Add member
            </Button>
            {rows.length >= MAX_TEAM_MEMBERS ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Maximum roster size reached.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Submitting registration…" : "Submit team registration"}
        </Button>
        <p className="text-xs text-muted-foreground">
          By submitting you confirm every player has agreed to the tournament
          rules.
        </p>
      </div>
    </form>
  )
}

function SuccessPanel({ state }: { state: RegistrationState }) {
  const undelivered = state.team?.undelivered ?? []

  return (
    <Card>
      <CardContent className="grid gap-3 py-6 text-center">
        <MailCheck className="mx-auto size-8 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Check your inbox</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {state.message}
        </p>
        <ol className="mx-auto grid max-w-md gap-1.5 text-left text-sm text-muted-foreground">
          <li>1. Open your roster dashboard link and verify your own phone.</li>
          <li>2. Each player opens their link, checks their details and verifies their phone.</li>
          <li>3. Submit the roster from the dashboard once everyone is green.</li>
        </ol>

        {undelivered.length > 0 ? (
          <p
            role="alert"
            className="mx-auto max-w-md rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-left text-xs text-destructive"
          >
            We could not deliver to {undelivered.join(", ")}. Your team is saved
            — resend those links from the roster dashboard.
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Registration ID: <code>{state.team?.id}</code> ·{" "}
          {state.team?.memberCount} player
          {state.team?.memberCount === 1 ? "" : "s"}
        </p>
      </CardContent>
    </Card>
  )
}

/** Moves member errors up one slot when a row above them is removed. */
function reindexMemberErrors(
  errors: Record<string, string>,
  removedIndex: number
) {
  const next: Record<string, string> = {}
  for (const [key, message] of Object.entries(errors)) {
    const match = /^members\.(\d+)\.(.+)$/.exec(key)
    if (!match) {
      next[key] = message
      continue
    }
    const index = Number(match[1])
    if (index === removedIndex) continue
    next[`members.${index > removedIndex ? index - 1 : index}.${match[2]}`] =
      message
  }
  return next
}
