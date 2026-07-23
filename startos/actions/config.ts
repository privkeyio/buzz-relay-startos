import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, Value } = sdk

export const inputSpec = InputSpec.of({
  s3Bucket: Value.text({
    name: i18n('Media Bucket'),
    description: i18n(
      'The S3/MinIO bucket name used for media storage (Blossom).',
    ),
    required: true,
    default: 'buzz-media',
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
      s3Bucket: data?.s3Bucket ?? 'buzz-media',
      autoMigrate: data?.autoMigrate ?? true,
    }
  },

  async ({ effects, input }) =>
    storeJson.merge(effects, {
      s3Bucket: input.s3Bucket,
      autoMigrate: input.autoMigrate,
    }),
)
