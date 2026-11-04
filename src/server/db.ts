import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { env as workerEnv } from 'cloudflare:workers'
import * as schema from './schema'

type DatabaseBindings = {
  TURSO_DATABASE_URL?: string
  TURSO_AUTH_TOKEN?: string
}

function createDatabase() {
  const bindings = workerEnv as unknown as DatabaseBindings
  const url = bindings.TURSO_DATABASE_URL
  if (!url) {
    throw new Error('TURSO_DATABASE_URL is not configured for this Worker.')
  }

  const client = createClient({
    url,
    authToken: bindings.TURSO_AUTH_TOKEN || undefined,
  })

  return drizzle(client, { schema })
}

let database: ReturnType<typeof createDatabase> | undefined

export function getDatabase() {
  database ??= createDatabase()
  return database
}
