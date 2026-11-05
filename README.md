# Flow

Flow is a responsive trip planner by Velo AI. It includes onboarding, email and password accounts, route comparison, editable itineraries, a trip wallet, and manually updated journey progress.

Passwords are salted and hashed with PBKDF2-SHA-256.

Velo generates personalized plans using Cloudflare Workers AI's `@cf/meta/llama-3.1-8b-instruct-fp8-fast`. New trips use verified Indian cities and a custom travel prompt, not the old fixed route catalog. Existing saved routes still work. AI fares and durations are planning estimates, not live quotes. Stripe Checkout remains test-only. Journey progress is updated by the traveler.

City search uses a bundled GeoNames index of 7,315 Indian cities and towns with population of at least 500, plus administrative capitals. It supports alternate names without a geocoding API key. Photos are fetched from Wikimedia Commons using nearby Wikipedia articles, with author and license links. Some towns have no photo. Data and photos are not sent to an image-generation service.

Before inference, Flow retrieves short Wikivoyage travel-guide excerpts for both cities, checks the article coordinates against the selected city, and supplies transport context to the model. Guide text is cached for a day per Worker instance and treated as untrusted reference material. Saved plans include revision links and CC BY-SA 4.0 attribution. Guide availability is optional and does not imply live schedule or fare verification.

The checked Gurugram to Agra research is stored as source facts, not pre-generated route options. After migrations, import it with `bun scripts/import-route-research.ts` against the intended database. Other city pairs use the same planner and city-guide retrieval without a route-specific template. The Days away control fixes the number of daily itinerary entries.

## Local development

Requirements: Bun, the Turso CLI, and the `sqld` binary installed with it.

1. Add the Turso CLI directory to `PATH` and start a local libSQL server:

   ```sh
   export PATH="$HOME/.turso:$PATH"
   mkdir -p .local
   sqld --db-path .local/flow.db --http-listen-addr 127.0.0.1:8080
   ```

2. In a second terminal, copy the local environment files and install packages. Add a Stripe test secret to `.dev.vars` before opening checkout:

   ```sh
   cp .dev.vars.example .dev.vars
   cp .env.example .env
   bun install
   ```

   Set `STRIPE_SECRET_KEY` to a Stripe test secret beginning with `sk_test_`. Flow rejects live keys. The key must stay in `.dev.vars` or a Worker secret, never in source control.

3. Create the local tables and start the app:

   ```sh
    bun run db:migrate
    bunx wrangler login
   bun run dev
   ```

The app runs at `http://localhost:3000`. Local account and trip data stays in the database served on port 8080. AI inference uses the signed-in Cloudflare account even during local development. No model runs locally.

## Checks

```sh
bun run typecheck
bun run build
```

## Pickup and drop-off points

After choosing a city, travelers can search for a nearby address or landmark, confirm a map pin, use their device location with permission, or keep a manually entered address. Entrance notes are optional. Search is debounced and cached; Photon requests are limited to nearby Indian results. Manual addresses are labeled as address-only and are not treated as verified coordinates. Pin selection preserves the chosen coordinates even when a nearby address is found.

Locations are saved with the trip and included in Velo's fixed facts, route endpoints, comparison, editing, journey and wallet views. Changing a city clears its previously selected point. Points must be within 60 km of the selected city center. Existing trips without exact locations keep their city-level behavior.

Address lookup uses [Photon](https://photon.komoot.io/) with OpenStreetMap attribution. Address searches and coordinates are posted to the authenticated server rather than put in application request URLs. Entrance notes are not sent to the geocoder. Device location is requested only after the traveler presses its button. Photon's public service permits reasonable project use but has no availability guarantee and may throttle requests. Search failures leave manual entry and pin selection available. Move to a dedicated Photon instance or a hosted geocoder before high-volume use. The public Nominatim API is not used for autocomplete, which its [usage policy](https://operations.osmfoundation.org/policies/nominatim/) prohibits.

## Turso and Cloudflare Workers

The Worker uses `@libsql/client/web` and Drizzle over HTTP, with no local database files or native SQLite dependencies. Hosted connections require a `libsql://` or `https://` URL and an auth token. A hosted Turso database must be created separately, with approval.

Before publishing, apply all migrations against the hosted database from a private shell:

```sh
TURSO_DATABASE_URL=libsql://YOUR-DATABASE.turso.io TURSO_AUTH_TOKEN=YOUR_TOKEN bun run db:migrate
```

Do not use `db:push` on a published database. The migration command records applied migrations. Existing local databases created with `db:push` need a migration baseline before using this command; do not reapply the initial CREATE TABLE migration to them.

Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `STRIPE_SECRET_KEY` as Worker secrets. Use a Stripe test secret beginning with `sk_test_`:

```sh
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put STRIPE_SECRET_KEY
```

The Worker custom domain is configured as `flow.squeakyfiddlepro.me` in `wrangler.jsonc`. Deploy with:

```sh
bun run deploy
```

Never commit `.env`, `.dev.vars`, or database tokens.

## Free service limits and sources

Workers AI includes 10,000 neurons per account per day. Free-plan inference stops when that allowance is exhausted. Paid accounts can incur overage charges, so stay on Workers Free to require a no-cost cutoff. Flow also limits each signed-in account to five generated plans daily. Failed inference does not consume that app limit. No paid fallback provider is configured.

- [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare structured-output examples](https://developers.cloudflare.com/workers-ai/features/json-mode/)
- [Travel-agent starter reviewed for inspiration](https://github.com/PMP56/cf_ai_travel_agent)
- [Turso on Workers](https://developers.cloudflare.com/workers/databases/third-party-integrations/turso/)
- [GeoNames download and CC BY 4.0 license](https://download.geonames.org/export/dump/)
- [Wikimedia image metadata API](https://www.mediawiki.org/wiki/API:Imageinfo)
- [Wikivoyage reuse and attribution](https://en.wikivoyage.org/wiki/Wikivoyage:How_to_re-use_Wikivoyage_guides)

To refresh city data, download `https://download.geonames.org/export/dump/IN.zip`, then run `python3 scripts/import-india.py /path/to/IN.zip`. The index is filtered, sorted and normalized by Flow. Wikimedia requests use a descriptive User-Agent; unavailable photos do not block planning.
