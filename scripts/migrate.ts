import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'

const url = process.env.TURSO_DATABASE_URL
if (!url) throw new Error('Set TURSO_DATABASE_URL before running migrations.')
const parsed = new URL(url)
const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
if (!local && !process.env.TURSO_AUTH_TOKEN) throw new Error('Set TURSO_AUTH_TOKEN for the hosted database.')
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
try {
  await migrate(drizzle(client), { migrationsFolder: './drizzle' })
  const result = await client.execute('PRAGMA foreign_key_check')
  if (result.rows.length) throw new Error('Database foreign key check failed.')
  console.log('Database migrations and foreign key check passed.')
} finally {
  client.close()
}
