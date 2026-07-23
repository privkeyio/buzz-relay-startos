import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

const shape = z.object({
  postgresPassword: z.string().nullable().catch(null).default(null),
  redisPassword: z.string().nullable().catch(null).default(null),
  s3AccessKey: z.string().nullable().catch(null).default(null),
  s3SecretKey: z.string().nullable().catch(null).default(null),
  s3Bucket: z.string().catch('buzz-media').default('buzz-media'),
  autoMigrate: z.boolean().catch(true).default(true),
})

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: 'store.json' },
  shape,
)
