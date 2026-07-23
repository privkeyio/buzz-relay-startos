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
  'Media Bucket': 6,
  'The S3/MinIO bucket name used for media storage (Blossom).': 7,
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
