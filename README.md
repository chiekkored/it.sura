# Itsura

Itsura is a Next.js ecommerce catalog and admin app backed by Supabase. The public side lists items and accepts requests, while the admin side manages listings, categories, users, orders, inventory, and activity logs.

## Prerequisites

- Node.js 20
- npm
- Docker Desktop
- Supabase CLI

Use Node 20 before running the app:

```bash
nvm use 20
```

## Local Setup

Install dependencies:

```bash
npm install
```

Start the local Supabase stack:

```bash
supabase start
```

Apply pending local migrations:

```bash
supabase migration up
```

Start the Next.js development server:

```bash
nvm use 20
npm run dev
```

Open the app at [http://localhost:3000](http://localhost:3000).

Local Supabase Studio runs at [http://127.0.0.1:54323](http://127.0.0.1:54323).

## Environment Variables

Create or update `.env.local` with the local Supabase values from `supabase start` and the local feature flag values.

Required variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FLAGS=
FLAGS_SECRET=
```

For portfolio screenshots, set `NEXT_PUBLIC_CATALOG_DEMO=true` to show a local sample catalog, product detail pages, and a simulated request form without Supabase. Demo submissions are not sent or saved. Set the variable to `false` or remove it to return to database-backed listings. Admin routes remain protected and continue to use Supabase authentication.

Do not commit real secret values.

## Feature Flags

This project uses Vercel Flags through the `flags` and `@flags-sdk/vercel` packages.

Feature flags:

- `admin-logs` controls the admin logs page, logs API, and whether activity logs are saved.
- `admin-pos-sales` controls the POS page, Sales page, and Sales APIs.

Local development reads flags from `.env.local`. Vercel flag values apply only after deployment in the selected Vercel environment.

## Supabase Migrations

Apply migrations locally:

```bash
supabase migration up
```

Check local migration status:

```bash
supabase migration list --local
```

Reset local Supabase and replay all migrations:

```bash
supabase db reset
```

This wipes local database data.

Link the Supabase CLI to production:

```bash
supabase link --project-ref <project-ref>
```

Check production migration status:

```bash
supabase migration list
```

Push pending migrations to production:

```bash
supabase db push
```

Review migrations before running `supabase db push`, because it applies schema changes to the hosted database.

## VS Code

The workspace includes a `Next.js + Supabase` launch configuration.

It starts local Supabase first, then runs:

```bash
source ~/.nvm/nvm.sh && nvm use 20 && npm run dev
```

## Useful Commands

Run lint:

```bash
npm run lint
```

Run TypeScript checks:

```bash
npx tsc --noEmit
```

Build for production:

```bash
npm run build
```
