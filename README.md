# Gym Manager

Owner dashboard for a gym built with Next.js 16 (App Router), Tailwind CSS v4 and Supabase.
Membership renewal reminders go out through WhatsApp `wa.me` deep links, so there are no Meta API fees.

## Structure

```
app/
  layout.tsx              Dashboard shell + sidebar
  page.tsx                Metrics + "Action Required" expiry list (server component)
  add-client/
    page.tsx              Loads trainers for the dropdown (server component)
    AddClientForm.tsx     Validated form + phone sanitisation (client component)
    actions.ts            Server Action: re-validates + inserts into Supabase
components/
  Sidebar.tsx, MetricCard.tsx, WhatsAppRemindButton.tsx
lib/
  supabase/server.ts      Server-only Supabase client (service-role key)
  phone.ts                sanitizePhone / isValidIntlPhone
  whatsapp.ts             Reminder message + wa.me URL builder
  dates.ts                "Today" in the gym's timezone, date formatting
  types.ts
proxy.ts                  HTTP Basic Auth gate for the owner
supabase/migrations/      SQL schema (trainers, clients, RLS, seed trainers)
```

## Setup

1. Create a free Supabase project.
2. Run `supabase/migrations/20261017000000_init_gym_schema.sql` in the SQL editor, or use `supabase db push`.
3. Copy `.env.example` to `.env.local` and fill it in.
4. Run `npm install`, then `npm run dev`, and open http://localhost:3000.

Deploy to Vercel's free tier and set the same environment variables there.

## CI/CD (`.github/workflows/pipeline.yml`)

| Trigger | What runs |
| --- | --- |
| Pull request | Typecheck + production build |
| Push to `main` | Typecheck + build → `supabase db push` (new migrations only) → deploy to Vercel production |
| Actions tab → "Run workflow" | Same as a push to `main` |

If the build or a migration fails, nothing is deployed.

### One-time setup

1. **GitHub:** create an empty **private** repo, then:
   ```bash
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. **Vercel:** import the repo at vercel.com/new, then **turn off** Settings → Git → "Automatic deployments" (or set `"git": {"deploymentEnabled": false}`), because GitHub Actions does the deploying. Add these under Settings → Environment Variables (Production): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `GYM_NAME`, `GYM_TIMEZONE`.
3. **GitHub secrets:** in the repo, go to Settings → Environments → New environment `production` and add:

   | Secret | Where to get it |
   | --- | --- |
   | `VERCEL_TOKEN` | vercel.com/account/tokens |
   | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Run `npx vercel link` locally and copy them from `.vercel/project.json` |
   | `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens |
   | `SUPABASE_PROJECT_ID` | The project ref in your Supabase URL (`<ref>.supabase.co`) |
   | `SUPABASE_DB_PASSWORD` | Your database password (Project Settings → Database) |

   Optional: add yourself as a "Required reviewer" on the environment to approve each production deploy.

4. **Already ran the SQL by hand in the Supabase editor?** Mark it as applied so the pipeline doesn't run it again:
   ```bash
   npx supabase migration repair --status applied 20261017000000 --linked
   ```
   The file is safe to re-run anyway.

### Changing the database later
Add a new file `supabase/migrations/<YYYYMMDDHHMMSS>_description.sql` (or run `npx supabase migration new description`). Never edit a migration that has already been applied.

## Security model

- RLS is enabled on both tables with **no policies**, so the public anon key can't read anything.
- All database access happens on the server with the service-role key (`import "server-only"` makes the build fail if it ever leaks into a client bundle).
- `proxy.ts` puts the whole app behind a username and password. Always serve it over HTTPS.
