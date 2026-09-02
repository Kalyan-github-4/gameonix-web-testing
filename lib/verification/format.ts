import { parsePhoneNumberFromString } from "libphonenumber-js"

/** `arjun.mehta@gmail.com` → `ar•••••••@gmail.com` */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!domain) return "•••"
  const head = local.slice(0, 2)
  return `${head}${"•".repeat(Math.max(local.length - 2, 3))}@${domain}`
}

/** `+919876543210` → `+91 •••••• 3210` */
export function maskPhone(phone: string): string {
  const parsed = parsePhoneNumberFromString(phone)
  const tail = phone.slice(-4)
  const prefix = parsed?.countryCallingCode ? `+${parsed.countryCallingCode} ` : ""
  return `${prefix}•••••• ${tail}`
}

/** E.164 back to something readable: `+919876543210` → `+91 98765 43210` */
export function formatPhone(phone: string): string {
  return parsePhoneNumberFromString(phone)?.formatInternational() ?? phone
}
