import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { routeResearch } from '../src/server/schema'
import rows from '../src/data/route-research.json'

const url = process.env.TURSO_DATABASE_URL
if (!url) throw new Error('Set TURSO_DATABASE_URL.')
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
try {
  const db = drizzle(client)
  for (const row of rows) await db.insert(routeResearch).values(row).onConflictDoUpdate({ target: routeResearch.id, set: row })
  console.log(`Imported ${rows.length} sourced route research records. No trip options were pre-generated.`)
} finally {
  client.close()
}
