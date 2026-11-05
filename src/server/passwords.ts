const ITERATIONS = 100_000

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256))
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2-sha256$${ITERATIONS}$${hex(salt)}$${hex(await derive(password, salt))}`
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  const match = stored?.match(/^pbkdf2-sha256\$100000\$([a-f0-9]{32})\$([a-f0-9]{64})$/)
  const salt = new Uint8Array(16)
  const expected = new Uint8Array(32)
  if (match) {
    for (let index = 0; index < salt.length; index++) salt[index] = parseInt(match[1]!.slice(index * 2, index * 2 + 2), 16)
    for (let index = 0; index < expected.length; index++) expected[index] = parseInt(match[2]!.slice(index * 2, index * 2 + 2), 16)
  }
  const actual = await derive(password, salt)
  let difference = 0
  for (let index = 0; index < actual.length; index++) difference |= actual[index]! ^ expected[index]!
  return Boolean(match) && difference === 0
}
