export const DEFAULT_LANG = 'en_US'

const dict = {
  // main.ts
  'Starting Buzz Relay!': 0,
  'Web Interface': 1,
  'The web interface is ready': 2,
  'The web interface is not ready': 3,

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
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
