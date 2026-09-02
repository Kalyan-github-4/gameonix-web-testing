This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Tournament team registration

The IGL registers the whole team from a single form.

| Route | Purpose |
| --- | --- |
| `/register` | Team registration form (team details, logo, IGL contact, roster) |
| `/admin/registrations` | Read-only list of submitted teams for organizers |

### Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to your Postgres database.
2. Apply the schema: `npm run db:migrate` (regenerate SQL with `npm run db:generate` after editing `lib/db/schema.ts`).
3. `npm run dev`

### Data model

- `teams` — team name, logo (URL + mime type + size), IGL name/phone/email, `status` (`pending` / `approved` / `rejected`), timestamps.
- `team_members` — one row per player: full name, phone, email, In-Game ID, roster `position`, cascading delete with the team.

Unique indexes enforce a single team per name, per IGL email and per IGL phone, and reject a player appearing twice in one team or on two different teams (by email or In-Game ID).

### Validation

`lib/tournament/validation.ts` holds the Zod schemas used by **both** the client form and the Server Action, so client-side feedback and server-side enforcement cannot drift:

- required fields, phone numbers (10–15 digits, optional country code), email addresses, name and In-Game ID formats;
- roster size between `MIN_TEAM_MEMBERS` and `MAX_TEAM_MEMBERS` (`lib/tournament/constants.ts`);
- no duplicate phone / email / In-Game ID within a team;
- logo must be PNG, JPEG or WebP and at most 2 MB — the server re-checks the file's magic bytes rather than trusting the browser-supplied MIME type.

Database unique violations are mapped back onto the offending form field, so a race between two submissions still produces a readable error.

### Logo storage

Logos are written to `public/uploads/team-logos/` (gitignored) by `lib/tournament/logo-storage.ts`. For a serverless deployment, replace `saveTeamLogo`/`deleteTeamLogo` with an object-storage upload; nothing else changes.
