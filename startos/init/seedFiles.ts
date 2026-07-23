import { utils } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { sdk } from '../sdk'

export const seedFiles = sdk.setupOnInit(async (effects, kind) => {
  if (kind === 'install') {
    await storeJson.merge(effects, {
      postgresPassword: utils.getDefaultString({
        charset: 'a-z,A-Z,0-9',
        len: 32,
      }),
      redisPassword: utils.getDefaultString({
        charset: 'a-z,A-Z,0-9',
        len: 32,
      }),
      s3AccessKey: utils.getDefaultString({ charset: 'a-z,A-Z,0-9', len: 20 }),
      s3SecretKey: utils.getDefaultString({ charset: 'a-z,A-Z,0-9', len: 40 }),
      relayPrivateKey: utils.getDefaultString({ charset: 'a-f,0-9', len: 64 }),
    })
  } else {
    // Backfill for installs that predate the relay identity key.
    const existing = await storeJson.read().once()
    await storeJson.merge(effects, {
      relayPrivateKey:
        existing?.relayPrivateKey ??
        utils.getDefaultString({ charset: 'a-f,0-9', len: 64 }),
    })
  }
})
