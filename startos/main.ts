import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import {
  healthPort,
  metricsPort,
  minioConsolePort,
  minioPort,
  postgresDb,
  postgresPort,
  postgresUser,
  redisPort,
  relayPort,
} from './utils'

export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting Buzz Relay!'))

  const store = await storeJson.read().const(effects)
  if (!store) throw new Error('no store.json')

  const {
    postgresPassword,
    redisPassword,
    s3AccessKey,
    s3SecretKey,
    relayPrivateKey,
  } = store
  if (
    !postgresPassword ||
    !redisPassword ||
    !s3AccessKey ||
    !s3SecretKey ||
    !relayPrivateKey
  ) {
    throw new Error('store.json is missing generated credentials')
  }

  const postgresSub = sdk.SubContainer.of(
    effects,
    { imageId: 'postgres' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'postgres',
      subpath: null,
      mountpoint: '/var/lib/postgresql/data',
      readonly: false,
    }),
    'buzz-postgres',
  )

  const redisSub = sdk.SubContainer.of(
    effects,
    { imageId: 'redis' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'redis',
      subpath: null,
      mountpoint: '/data',
      readonly: false,
    }),
    'buzz-redis',
  )

  const minioSub = sdk.SubContainer.of(
    effects,
    { imageId: 'minio' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'minio',
      subpath: null,
      mountpoint: '/data',
      readonly: false,
    }),
    'buzz-minio',
  )

  const minioInitSub = sdk.SubContainer.of(
    effects,
    { imageId: 'minio-mc' },
    null,
    'buzz-minio-init',
  )

  const relayMounts = sdk.Mounts.of().mountVolume({
    volumeId: 'main',
    subpath: null,
    mountpoint: '/data',
    readonly: false,
  })
  const relaySub = sdk.SubContainer.of(
    effects,
    { imageId: 'buzz-relay' },
    relayMounts,
    'buzz-relay-sub',
  )
  const relayPrepSub = sdk.SubContainer.of(
    effects,
    { imageId: 'buzz-relay' },
    relayMounts,
    'buzz-relay-prep',
  )

  // In-package daemons share a network namespace, so the compose DNS names
  // (postgres/redis/minio) become 127.0.0.1. Generated credentials are
  // alphanumeric, so they need no URL escaping here.
  const relayEnv: Record<string, string> = {
    BUZZ_BIND_ADDR: `0.0.0.0:${relayPort}`,
    BUZZ_HEALTH_PORT: String(healthPort),
    BUZZ_METRICS_PORT: String(metricsPort),
    DATABASE_URL: `postgres://${postgresUser}:${postgresPassword}@127.0.0.1:${postgresPort}/${postgresDb}`,
    REDIS_URL: `redis://:${redisPassword}@127.0.0.1:${redisPort}`,
    // A stable, per-install relay identity. Without it the relay falls back to
    // a hardcoded dev keypair and serves REST with token auth bypassed.
    BUZZ_RELAY_PRIVATE_KEY: relayPrivateKey,
    BUZZ_REQUIRE_AUTH_TOKEN: 'true',
    BUZZ_S3_ENDPOINT: `http://127.0.0.1:${minioPort}`,
    BUZZ_S3_ACCESS_KEY: s3AccessKey,
    BUZZ_S3_SECRET_KEY: s3SecretKey,
    BUZZ_S3_BUCKET: store.s3Bucket,
    BUZZ_GIT_REPO_PATH: '/data/git',
    BUZZ_AUTO_MIGRATE: String(store.autoMigrate),
    BUZZ_GIT_CONFORMANCE_PROBE: 'true',
  }

  return (
    sdk.Daemons.of(effects)
      .addDaemon('postgres', {
        subcontainer: postgresSub,
        exec: {
          command: ['docker-entrypoint.sh', 'postgres'],
          env: {
            POSTGRES_DB: postgresDb,
            POSTGRES_USER: postgresUser,
            POSTGRES_PASSWORD: postgresPassword,
            PGDATA: '/var/lib/postgresql/data/pgdata',
          },
        },
        ready: {
          display: i18n('Database'),
          gracePeriod: 30_000,
          fn: () =>
            sdk.healthCheck.runHealthScript(
              ['pg_isready', '-U', postgresUser, '-d', postgresDb],
              postgresSub,
              {
                errorMessage: i18n('The database is not accepting connections'),
              },
            ),
        },
        requires: [],
      })
      .addDaemon('redis', {
        subcontainer: redisSub,
        exec: {
          command: [
            'redis-server',
            '--appendonly',
            'yes',
            '--dir',
            '/data',
            '--requirepass',
            redisPassword,
          ],
        },
        ready: {
          display: i18n('Cache'),
          gracePeriod: 30_000,
          fn: () =>
            sdk.healthCheck.runHealthScript(
              ['redis-cli', '-a', redisPassword, 'ping'],
              redisSub,
              { errorMessage: i18n('Redis is not responding') },
            ),
        },
        requires: [],
      })
      .addDaemon('minio', {
        subcontainer: minioSub,
        exec: {
          command: [
            'minio',
            'server',
            '/data',
            '--address',
            `127.0.0.1:${minioPort}`,
            '--console-address',
            `127.0.0.1:${minioConsolePort}`,
          ],
          env: {
            MINIO_ROOT_USER: s3AccessKey,
            MINIO_ROOT_PASSWORD: s3SecretKey,
          },
        },
        ready: {
          display: i18n('Media Storage'),
          gracePeriod: 30_000,
          fn: () =>
            sdk.healthCheck.runHealthScript(
              [
                'curl',
                '-fsS',
                '--max-time',
                '5',
                `http://127.0.0.1:${minioPort}/minio/health/live`,
              ],
              minioSub,
              { errorMessage: i18n('MinIO is not responding') },
            ),
        },
        requires: [],
      })
      .addOneshot('minio-init', {
        subcontainer: minioInitSub,
        exec: {
          command: [
            '/bin/sh',
            '-ec',
            [
              `mc alias set local http://127.0.0.1:${minioPort} "$BUZZ_S3_ACCESS_KEY" "$BUZZ_S3_SECRET_KEY"`,
              'mc mb --ignore-existing "local/$BUZZ_S3_BUCKET"',
              'mc anonymous set none "local/$BUZZ_S3_BUCKET"',
            ].join('\n'),
          ],
          env: {
            BUZZ_S3_ACCESS_KEY: s3AccessKey,
            BUZZ_S3_SECRET_KEY: s3SecretKey,
            BUZZ_S3_BUCKET: store.s3Bucket,
          },
        },
        requires: ['minio'],
      })
      // The relay image runs as uid 1000; the mounted volume starts out root-owned.
      .addOneshot('prepare-data', {
        subcontainer: relayPrepSub,
        exec: {
          command: [
            '/bin/sh',
            '-ec',
            'mkdir -p /data/git && chown -R 1000:1000 /data',
          ],
          user: 'root',
        },
        requires: [],
      })
      .addDaemon('relay', {
        subcontainer: relaySub,
        exec: {
          command: ['/usr/local/bin/buzz-relay'],
          env: relayEnv,
          user: 'buzz',
        },
        ready: {
          display: i18n('Community Endpoint'),
          gracePeriod: 60_000,
          fn: () =>
            sdk.healthCheck.runHealthScript(
              [
                'curl',
                '-fsS',
                '--max-time',
                '5',
                `http://127.0.0.1:${healthPort}/_readiness`,
              ],
              relaySub,
              {
                errorMessage: i18n('The Buzz community endpoint is not ready'),
              },
            ),
        },
        requires: ['postgres', 'redis', 'minio-init', 'prepare-data'],
      })
  )
})
