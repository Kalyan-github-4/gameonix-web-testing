import { Check, Clock, X } from "lucide-react"

import { cn } from "@/lib/utils"

const TONES = {
  verified: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  waiting: "border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-400",
  blocked: "border-destructive/30 bg-destructive/10 text-destructive",
} as const

const ICONS = { verified: Check, waiting: Clock, blocked: X }

export function StatusChip({
  tone,
  children,
  className,
}: {
  tone: keyof typeof TONES
  children: React.ReactNode
  className?: string
}) {
  const Icon = ICONS[tone]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {children}
    </span>
  )
}
