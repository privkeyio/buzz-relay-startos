// Here we define any constants or functions that are shared by multiple components
// throughout the package codebase. This file will be unnecessary for many packages.

export const relayPort = 3000
export const healthPort = 8080
export const metricsPort = 9102
export const postgresPort = 5432
export const redisPort = 6379
export const minioPort = 9000
export const minioConsolePort = 9001

export const postgresUser = 'buzz'
export const postgresDb = 'buzz'

// S3/MinIO bucket naming contract: 3-63 chars, lowercase letters, numbers,
// dots or hyphens, starting and ending with a letter or number.
export const bucketNamePattern = '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$'

// Public community host, e.g. buzz1.privkey.io. Lowercase DNS name, no scheme,
// no port, no path — the package derives RELAY_URL/BUZZ_DOMAIN from it.
export const communityHostPattern =
  '^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,}$'

// Owner identity: either a bech32 npub or a raw 64-char hex pubkey.
export const ownerPubkeyPattern = '^(npub1[a-z0-9]{58}|[0-9a-fA-F]{64})$'

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
  let chk = 1
  for (const v of values) {
    const top = chk >>> 25
    chk = ((chk & 0x1ffffff) << 5) ^ v
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i]
  }
  return chk
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = []
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5)
  out.push(0)
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31)
  return out
}

// Decode an npub (bech32) into its 64-char lowercase hex pubkey. Returns null on
// any malformed input (bad char, wrong hrp, failed checksum, wrong length).
function decodeNpub(npub: string): string | null {
  const lower = npub.toLowerCase()
  if (!lower.startsWith('npub1')) return null
  const data = lower.slice(5)
  const values: number[] = []
  for (const c of data) {
    const idx = BECH32_CHARSET.indexOf(c)
    if (idx === -1) return null
    values.push(idx)
  }
  const hrp = 'npub'
  if (bech32Polymod(hrpExpand(hrp).concat(values)) !== 1) return null

  // Drop the 6-char checksum, then regroup 5-bit words into bytes.
  const words = values.slice(0, -6)
  const bytes: number[] = []
  let acc = 0
  let bits = 0
  for (const w of words) {
    acc = (acc << 5) | w
    bits += 5
    while (bits >= 8) {
      bits -= 8
      bytes.push((acc >> bits) & 0xff)
    }
  }
  // Leftover bits must be padding zeros; a valid 32-byte key leaves 4 bits.
  if (bits >= 5 || (acc & ((1 << bits) - 1)) !== 0) return null
  if (bytes.length !== 32) return null
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Normalize an owner identity (npub or hex) to a 64-char lowercase hex pubkey,
// or null if it is neither a valid npub nor 64 hex chars.
export function ownerPubkeyToHex(input: string): string | null {
  const trimmed = input.trim()
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed.toLowerCase()
  if (trimmed.toLowerCase().startsWith('npub1')) return decodeNpub(trimmed)
  return null
}
