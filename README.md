# Gameonix — Tournament Team Registration

A Next.js app for registering esports teams for a Gamonix tournament. The team's
in-game leader (IGL) fills in one form with the team details, logo and roster.
The IGL and every player then confirm their email by link and their phone by
one-time code (OTP), and organizers review the submitted teams in a
password-protected admin page.

| Route | What it does |
| --- | --- |
| `/` | Landing page |
| `/register` | Team registration form (team name, logo, IGL contact, roster) |
| `/verify/team/[token]` | IGL's verification hub, opened from the emailed link |
| `/verify/[token]` | A player's own verification page, opened from the emailed link |
| `/admin/registrations` | Read-only list of submitted teams (HTTP Basic auth) |

**Tech stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript,
Tailwind CSS 4 with shadcn/ui, PostgreSQL through Drizzle ORM, Zod,
Nodemailer or Resend for email, and Fast2SMS for SMS. Team logos are stored in
the Postgres database itself, so there is no separate file storage to set up.

---

## 1. Prerequisites

Install these first:

- **Node.js 20 or newer.** Check with `node -v`.
- **npm**, which comes with Node.
- **Git**
- **A PostgreSQL database.** Either of these works:
  - a local install ([postgresql.org/download](https://www.postgresql.org/download/)),
    or run one in Docker:
    ```bash
    docker run --name gamonix-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=gamonix -p 5432:5432 -d postgres:16
    ```
  - a free hosted database such as [Neon](https://neon.tech) or
    [Supabase](https://supabase.com). Copy its connection string.

You don't need email or SMS accounts to run the app locally. Section 3
explains how to work without them.

---

## 2. Get the code and install dependencies

```bash
git clone https://github.com/Kalyan-github-4/gameonix-web-testing.git
cd gameonix-web-testing
npm install
```

---

## 3. Configure environment variables

Copy the example file to `.env`:

```bash
# macOS / Linux / Git Bash
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

> Use `.env` rather than `.env.local`. The database tools (`drizzle-kit`) and the
> scripts in `scripts/` read only `.env`. `.env` is gitignored, so never commit it.

Open `.env` and fill in the values. Every variable is documented in
[.env.example](.env.example). A minimal local setup looks like this:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/gamonix"
APP_URL="http://localhost:3000"

# Required. Generate a random value (see below).
VERIFICATION_TOKEN_PEPPER="paste-generated-value-here"

# Print OTP codes to the terminal instead of sending real SMS (dev only).
SMS_PROVIDER="console"

# Email: needed to send verification links (see "Email" below).
MAIL_PROVIDER="smtp"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="you@gmail.com"
SMTP_PASSWORD="your-16-char-app-password"
MAIL_FROM="Gamonix <you@gmail.com>"

# Login for /admin/registrations. Both must be set.
ADMIN_USER="organizer"
ADMIN_PASSWORD="choose-a-strong-password"

VERIFICATION_ENABLED="true"
```

Generate `VERIFICATION_TOKEN_PEPPER` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### What each group of variables does

| Variable(s) | Required? | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string. Hosted providers need `?sslmode=require`. Percent-encode special characters (`@ : / ? #`) in the password. |
| `APP_URL` | In production | The public URL used in emailed links. Defaults to `http://localhost:3000` in development. |
| `VERIFICATION_TOKEN_PEPPER` | Yes | Secret key for hashing verification tokens and OTPs. If you change it, links and codes that were already sent stop working. |
| `MAIL_PROVIDER` + `SMTP_*` / `RESEND_API_KEY`, `MAIL_FROM` | To send email | `smtp` (e.g. Gmail) or `resend`. |
| `SMS_PROVIDER`, `FAST2SMS_API_KEY` | To send SMS | `console` for local development, `fast2sms` for real OTPs to Indian (+91) numbers. |
| `ADMIN_USER`, `ADMIN_PASSWORD` | For admin page | If either is missing, `/admin` denies everyone. |
| `VERIFICATION_ENABLED` | No | Set to `"false"` to stop all outgoing emails and OTPs at once. |

### Email

- **Gmail (SMTP):** turn on 2-Step Verification for your Google account, then
  create an **App Password** (Google Account → Security → 2-Step Verification →
  App passwords). Put that 16-character password in `SMTP_PASSWORD`. Your
  normal account password will not work. `MAIL_FROM` must use the same address
  as `SMTP_USER`.
- **Resend:** set `MAIL_PROVIDER="resend"` and `RESEND_API_KEY`. Until you
  verify a sending domain, `MAIL_FROM` must stay on `onboarding@resend.dev`, and
  Resend only delivers to your own account email.

**No email set up?** You can still test the whole flow. After submitting a
registration, run `npm run verify:links` (see [Scripts](#6-useful-scripts)). It
prints working verification links in the terminal.

### SMS

With `SMS_PROVIDER="console"`, OTP codes are printed in the terminal running
`npm run dev`, and in development they are also shown on the page. This mode
refuses to run in production. For real SMS, use `SMS_PROVIDER="fast2sms"` with
a key from Fast2SMS → Dev API.

---

## 4. Set up the database

Create the tables by applying the migrations in [drizzle/](drizzle/):

```bash
npm run db:migrate
```

To browse the data in a web UI, run:

```bash
npm run db:studio
```

---

## 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then go to
[/register](http://localhost:3000/register) to submit a test team.

To run a production build locally:

```bash
npm run build
npm start
```

---

## 6. Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` / `npm start` | Build and serve the production app |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Apply migrations from `drizzle/` to the database |
| `npm run db:generate` | Create a new migration after editing `lib/db/schema.ts` |
| `npm run db:push` | Push schema changes straight to the database without a migration file (only for quick local experiments) |
| `npm run db:studio` | Open Drizzle Studio to browse the database |
| `npm run verify:links` | Print fresh verification links for the latest registration without sending email. Any links printed earlier stop working. |
| `npm run verify:smoke` | End-to-end check of the verification flow against the real database. It creates a test team, verifies it, then deletes it. |

---

## 7. How registration works

1. The IGL submits `/register` with team details, logo and roster. The team is
   saved with status `awaiting_verification`.
2. The IGL receives an email link to their **verification hub**
   (`/verify/team/[token]`). There they confirm their email and phone (OTP) and
   send each player their own link.
3. Each player opens their link (`/verify/[token]`), checks their details and
   verifies their phone with an OTP.
4. Once everyone is verified, the team moves to `pending`. Organizers then
   review it at `/admin/registrations` and approve or reject it.

Verification links expire after 72 hours. OTPs last 10 minutes, and sends are
rate-limited. All of these limits, plus the roster size, are set in
[lib/tournament/constants.ts](lib/tournament/constants.ts).

> **Roster size:** `MIN_TEAM_MEMBERS` and `MAX_TEAM_MEMBERS` are both set to `1`
> right now for testing. Raise them to the real squad size before running a
> tournament.

### Validation

[lib/tournament/validation.ts](lib/tournament/validation.ts) contains the Zod
schemas that the form and the server action both use, so the browser and the
server always apply the same rules:

- required fields, phone number, email, name and In-Game ID formats
- roster size limits
- no duplicate phone, email or In-Game ID within a team
- the logo must be PNG, JPEG or WebP and at most 2 MB. The server checks the
  file's actual bytes, not the file type the browser reports.

The database also blocks duplicates: one team per name, per IGL email and per
IGL phone, and no player on two teams. If a submission breaks one of these
rules, the error appears on the matching form field.

### Logo storage

Logos are saved in the database, in the `team_logos` table (a `bytea` column),
in the same transaction as the team. If a registration fails, no logo is left
behind, and deleting a team deletes its logo too. The team row stores the URL
`/logos/<id>`, and [app/logos/[id]/route.ts](app/logos/[id]/route.ts) serves the
image from the database with long-lived cache headers. The upload is checked in
[lib/tournament/logo-storage.ts](lib/tournament/logo-storage.ts).

---

## 8. Project structure

```
app/
  page.tsx                   Landing page
  register/                  Registration form + server action
  verify/[token]/            Player verification page
  verify/team/[token]/       IGL verification hub
  admin/registrations/       Organizer view
components/
  registration/              Form components
  verification/              OTP panel, status chips, hub UI
  ui/                        shadcn/ui primitives
lib/
  db/                        Drizzle client and schema
  mail/                      Email transport (SMTP / Resend) and templates
  sms/                       SMS transport (console / Fast2SMS)
  verification/              Tokens, OTPs, verification service, env config
  tournament/                Constants, validation, logo storage
  admin/                     Basic-auth helpers for /admin
drizzle/                     SQL migrations
scripts/                     verify-links and verify-smoke helpers
proxy.ts                     Protects /admin/* with HTTP Basic auth
```

---

## 9. Deploying to Vercel

1. Import the repository into [Vercel](https://vercel.com/new).
2. Add all the environment variables from `.env` in the project settings. Set
   `APP_URL` to your production URL and use a real `SMS_PROVIDER`, because
   `console` is refused in production.
3. Run `npm run db:migrate` against the production `DATABASE_URL` before the
   first deploy, and again whenever you add new migrations.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `DATABASE_URL is not set` | Make sure the file is named `.env` (not `.env.example`), is in the project root, and has a value for `DATABASE_URL`. |
| `VERIFICATION_TOKEN_PEPPER is not set` | Generate one with the command in section 3. |
| Can't connect to a hosted database | Add `?sslmode=require` to the URL and percent-encode special characters in the password. |
| Gmail rejects login | Use an App Password, not your account password, and keep `MAIL_FROM` on the same address as `SMTP_USER`. |
| Emails never arrive with Resend | Until your domain is verified, Resend only delivers to your own account email. Use `npm run verify:links` for other addresses. |
| `/admin` keeps asking for a password | Set both `ADMIN_USER` and `ADMIN_PASSWORD`, then restart the dev server. |
| Registration fails with `relation "team_logos" does not exist` | Run `npm run db:migrate`. |
| Port 3000 already in use | Run `npm run dev -- -p 3001` and set `APP_URL` to match. |
