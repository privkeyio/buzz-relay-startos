import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import {
  bucketNamePattern,
  communityHostPattern,
  ownerPubkeyPattern,
  ownerPubkeyToHex,
} from '../utils'

const { InputSpec, Value } = sdk

export const inputSpec = InputSpec.of({
  communityHost: Value.text({
    name: i18n('Community Host'),
    description: i18n(
      'The public domain your community is reached at, exactly as added in Buzz Desktop (e.g. buzz1.privkey.io). No scheme, port, or path. The relay binds its community to this host.',
    ),
    required: true,
    default: null,
    placeholder: 'buzz1.privkey.io',
    patterns: [
      {
        regex: communityHostPattern,
        description: i18n(
          'Must be a bare lowercase domain name, e.g. buzz1.privkey.io (no https://, no port, no path).',
        ),
      },
    ],
  }),
  ownerPubkey: Value.text({
    name: i18n('Owner Public Key'),
    description: i18n(
      'Your Nostr public key — makes you the owner/admin of this community. Accepts an npub1… or a 64-character hex key.',
    ),
    required: true,
    default: null,
    placeholder: 'npub1…',
    patterns: [
      {
        regex: ownerPubkeyPattern,
        description: i18n(
          'Must be an npub1… key or a 64-character hex public key.',
        ),
      },
    ],
  }),
  s3Bucket: Value.text({
    name: i18n('Media Bucket'),
    description: i18n(
      'The S3/MinIO bucket name used for media storage (Blossom).',
    ),
    required: true,
    default: 'buzz-media',
    patterns: [
      {
        regex: bucketNamePattern,
        description: i18n(
          'Must be 3-63 characters: lowercase letters, numbers, dots or hyphens, starting and ending with a letter or number.',
        ),
      },
    ],
  }),
  autoMigrate: Value.toggle({
    name: i18n('Auto-Migrate Database'),
    description: i18n(
      'Automatically run database migrations on startup. Recommended.',
    ),
    default: true,
  }),
})

export const config = sdk.Action.withInput(
  'config',

  async ({ effects }) => ({
    name: i18n('Configuration'),
    description: i18n('Configure storage and database options for Buzz Relay.'),
    warning: i18n('Changes take effect the next time Buzz Relay starts.'),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => {
    const data = await storeJson.read().once()
    return {
      communityHost: data?.communityHost ?? '',
      ownerPubkey: data?.ownerPubkey ?? '',
      s3Bucket: data?.s3Bucket ?? 'buzz-media',
      autoMigrate: data?.autoMigrate ?? true,
    }
  },

  async ({ effects, input }) => {
    // Store the owner key as hex; the relay's RELAY_OWNER_PUBKEY wants hex, so
    // decode npub here and reject anything that fails bech32/hex validation.
    const ownerPubkey = ownerPubkeyToHex(input.ownerPubkey)
    if (!ownerPubkey) {
      throw new Error(
        'Owner Public Key must be a valid npub1… or 64-character hex key.',
      )
    }
    return storeJson.merge(effects, {
      communityHost: input.communityHost.trim().toLowerCase(),
      ownerPubkey,
      s3Bucket: input.s3Bucket,
      autoMigrate: input.autoMigrate,
    })
  },
)
