import { VERIFICATION_WINDOW_HOURS } from "@/lib/tournament/constants"

import type { MailMessage } from "./client"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Deliberately plain HTML. The click on this link is the proof that the player
 * reads this inbox, so anything that trips a spam filter — image-heavy layout,
 * a shortened URL, a mismatched display link — breaks the whole flow.
 */
function layout({
  heading,
  intro,
  buttonLabel,
  url,
  outro,
}: {
  heading: string
  intro: string
  buttonLabel: string
  url: string
  outro: string
}): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f5f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#14171f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #d7dce6;border-radius:8px;">
    <tr><td style="padding:28px 28px 8px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#767e92;">Gamonix Tournament</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a5163;">${escapeHtml(intro)}</p>
      <p style="margin:0 0 20px;">
        <a href="${url}" style="display:inline-block;background:#2340d6;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:11px 20px;border-radius:6px;">${escapeHtml(buttonLabel)}</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#767e92;">${escapeHtml(outro)}</p>
      <p style="margin:0 0 24px;font-size:12px;line-height:1.6;color:#767e92;word-break:break-all;">If the button does not work, paste this into your browser:<br>${escapeHtml(url)}</p>
    </td></tr>
  </table>
</body></html>`
}

export function memberVerificationMail({
  to,
  memberName,
  teamName,
  iglName,
  url,
}: {
  to: string
  memberName: string
  teamName: string
  iglName: string
  url: string
}): MailMessage {
  const intro = `${iglName} registered you for the Gamonix tournament with ${teamName}. Open your page, check the details are right, and verify your phone number to lock in your spot.`
  const outro = `This link is yours alone — do not forward it. It expires in ${VERIFICATION_WINDOW_HOURS} hours. If you were not expecting this, ignore this email and nothing happens.`

  return {
    to,
    subject: `Verify your spot on ${teamName}`,
    html: layout({
      heading: `${memberName}, confirm your roster spot`,
      intro,
      buttonLabel: "Check my details",
      url,
      outro,
    }),
    text: `${memberName}, confirm your roster spot\n\n${intro}\n\n${url}\n\n${outro}`,
  }
}

export function iglHubMail({
  to,
  iglName,
  teamName,
  url,
}: {
  to: string
  iglName: string
  teamName: string
  url: string
}): MailMessage {
  const intro = `${teamName} is registered. Verify your own phone number, then track your players here as they verify theirs. Once everyone is green you can submit the final roster.`
  const outro = `Keep this link private — it controls your team's registration. It expires in ${VERIFICATION_WINDOW_HOURS} hours.`

  return {
    to,
    subject: `${teamName} — verify your roster`,
    html: layout({
      heading: `${iglName}, your roster needs verifying`,
      intro,
      buttonLabel: "Open roster dashboard",
      url,
      outro,
    }),
    text: `${iglName}, your roster needs verifying\n\n${intro}\n\n${url}\n\n${outro}`,
  }
}
