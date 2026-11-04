# Flow

Flow is a responsive trip planner by Velo AI. It includes onboarding, email-only demo accounts, route comparison, editable itineraries, a trip wallet, and manually updated journey progress.

The route catalog provides planning estimates for a small set of city pairs. It does not query live transit schedules or book tickets. The app does not collect payments. Journey status changes come from actions a traveler records in the app.

## Local development

Requirements: Bun, the Turso CLI, and the `sqld` binary installed with it.

1. Add the Turso CLI directory to `PATH` and start a local libSQL server:

   ```sh
   export PATH="$HOME/.turso:$PATH"
   mkdir -p .local
   sqld --db-path .local/flow.db --http-listen-addr 127.0.0.1:8080
   ```

2. In a second terminal, copy the local environment files and install packages:

   ```sh
   cp .dev.vars.example .dev.vars
   cp .env.example .env
   bun install
   ```

3. Create the local tables and start the app:

   ```sh
   bun run db:push
   bun run dev
   ```

The app runs at `http://localhost:3000`. Local account and trip data stays in `.local/flow.db`.

## Checks

```sh
bun run typecheck
bun run build
```

## Turso and Cloudflare Workers

Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in the environment before running `bun run db:push` against the hosted database. Configure the same values as Worker secrets:

```sh
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN
```

The Worker custom domain is configured as `flow.squeakyfiddlepro.me` in `wrangler.jsonc`. Deploy with:

```sh
bun run deploy
```

Never commit `.env`, `.dev.vars`, or database tokens.
