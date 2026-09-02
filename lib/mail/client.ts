import { Resend } from "resend"

import { mailFrom, resendApiKey } from "@/lib/verification/config"

let client: Resend | undefined

function resend(): Resend {
  return (client ??= new Resend(resendApiKey()))
}

export type MailMessage = {
  to: string
  subject: string
  html: string
  text: string
}

/**
 * Sends one transactional mail. Returns rather than throws: a registration is
 * already committed by the time mail goes out, so a provider hiccup must never
 * be reported to the IGL as a failed submission.
 */
export async function sendMail(
  message: MailMessage
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  try {
    const { data, error } = await resend().emails.send({
      from: mailFrom(),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    })

    if (error) {
      console.error("[mail] send failed", message.subject, error)
      return { ok: false, error: error.message }
    }
    return { ok: true, id: data?.id ?? null }
  } catch (error) {
    console.error("[mail] send threw", message.subject, error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown mail error",
    }
  }
}
