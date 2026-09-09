import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"
import { Resend } from "resend"

import { mailFrom, mailProvider, resendApiKey } from "@/lib/verification/config"

let client: Resend | undefined
let smtpClient: Transporter | undefined

function resend(): Resend {
  return (client ??= new Resend(resendApiKey()))
}

function smtp(): Transporter {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? "587")
  const user = process.env.SMTP_USER
  const password = process.env.SMTP_PASSWORD

  if (!host || !user || !password) {
    throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASSWORD are required")
  }
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("SMTP_PORT must be a positive integer")
  }

  return (smtpClient ??= nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: password },
  }))
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
    if (mailProvider() === "smtp") {
      const info = await smtp().sendMail({
        from: mailFrom(),
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      })
      return { ok: true, id: info.messageId ?? null }
    }

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
