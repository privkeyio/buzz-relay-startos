export const DEFAULT_LANG = 'en_US'

const dict = {
  // main.ts
  'Starting Buzz Relay!': 0,
  Database: 1,
  'The database is not accepting connections': 2,
  Cache: 3,
  'Redis is not responding': 14,
  'Media Storage': 15,
  'MinIO is not responding': 16,
  'Community Endpoint': 17,
  'The Buzz community endpoint is not ready': 18,

  // interfaces.ts
  'Web UI': 4,
  'The web interface of Buzz Relay': 5,

  // actions/config.ts
  'Community Host': 19,
  'The public clearnet domain your community is reached at, exactly as added in Buzz Desktop (e.g. buzz1.privkey.io). No scheme, port, or path. REQUIREMENTS: (1) a real public domain — Buzz Desktop only trusts standard public certificate authorities, so a LAN .local or Tor .onion address will NOT work; (2) add this domain to Buzz Relay in StartOS with Let’s Encrypt as the ACME provider; (3) port 443 must be publicly reachable on the IP the domain points to. The relay binds its community to this host on first start.': 20,
  'Set this to your final domain BEFORE starting Buzz Relay for the first time. The relay permanently binds its community to this host on first start, and there is no way to rename or re-point it afterward — changing it strands your existing community, channels, members, and every user’s NIP-05 identity. To move to a different domain you must reset the community (wipe all data) and start over.': 26,
  'Must be a bare lowercase domain name, e.g. buzz1.privkey.io (no https://, no port, no path).': 21,
  'Owner Public Key': 22,
  'Your Nostr public key — makes you the owner/admin of this community. Accepts an npub1… or a 64-character hex key.': 23,
  'Must be an npub1… key or a 64-character hex public key.': 24,
  'Media Bucket': 6,
  'The S3/MinIO bucket name used for media storage (Blossom). Changing this after media has been uploaded points the relay at a fresh, empty bucket — every previously uploaded file stays in the old bucket and becomes unreachable, with no automatic migration.': 7,
  'Changing the media bucket orphans all previously uploaded media. Existing files remain in the old bucket and will no longer be served. Only change this on a fresh install or if you intend to start with empty media storage.': 25,
  'Auto-Migrate Database': 8,
  'Automatically run database migrations on startup. Recommended.': 9,
  Configuration: 10,
  'Configure storage and database options for Buzz Relay.': 11,
  'Changes take effect the next time Buzz Relay starts.': 12,
  'Must be 3-63 characters: lowercase letters, numbers, dots or hyphens, starting and ending with a letter or number.': 13,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
