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
    s3RelayAccessKey,
    s3RelaySecretKey,
    relayPrivateKey,
  } = store
  if (
    !postgresPassword ||
    !redisPassword ||
    !s3AccessKey ||
    !s3SecretKey ||
    !s3RelayAccessKey ||
    !s3RelaySecretKey ||
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

  // The relay only needs its git repo, so mount just the `git` subpath. This
  // keeps store.json — which holds the MinIO root creds, DB/redis passwords,
  // and the relay private key at the main volume root — out of the relay
  // container's mount namespace, so a relay compromise can't read it off disk.
  const relayDataMounts = sdk.Mounts.of().mountVolume({
    volumeId: 'main',
    subpath: 'git',
    mountpoint: '/data/git',
    readonly: false,
  })
  // prepare-data runs as root and normalizes ownership across the whole volume
  // (and manages the /data/.chowned sentinel), so it mounts the full main
  // volume rather than the git subpath.
  const relayPrepMounts = sdk.Mounts.of().mountVolume({
    volumeId: 'main',
    subpath: null,
    mountpoint: '/data',
    readonly: false,
  })
  const relaySub = sdk.SubContainer.of(
    effects,
    { imageId: 'buzz-relay' },
    relayDataMounts,
    'buzz-relay-sub',
  )
  const relayPrepSub = sdk.SubContainer.of(
    effects,
    { imageId: 'buzz-relay' },
    relayPrepMounts,
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
    // Scoped MinIO service account (provisioned by minio-init), not the root
    // credentials — a relay compromise is confined to the single media bucket.
    BUZZ_S3_ACCESS_KEY: s3RelayAccessKey,
    BUZZ_S3_SECRET_KEY: s3RelaySecretKey,
    BUZZ_S3_BUCKET: store.s3Bucket,
    BUZZ_GIT_REPO_PATH: '/data/git',
    BUZZ_AUTO_MIGRATE: String(store.autoMigrate),
    // Upstream production default (deploy/compose defaults this to true). Gates
    // startup on a git object-store conformance probe (~7s); the relay's
    // gracePeriod must stay above that so readiness doesn't fail early.
    BUZZ_GIT_CONFORMANCE_PROBE: 'true',
  }

  // Admin-set community identity. The relay auto-seeds its single community from
  // RELAY_URL's host at startup, so this must match the public domain the
  // community was added as, or every request 404s "no community configured for
  // this host". Left unset until the admin fills in the Config action, so the
  // service still boots (and 404s) instead of crash-looping. CORS is left
  // permissive on purpose — setting BUZZ_CORS_ORIGINS to an allowlist rejects
  // the desktop client's tauri://localhost origin.
  const { communityHost, ownerPubkey } = store
  if (communityHost) {
    relayEnv.RELAY_URL = `wss://${communityHost}`
    relayEnv.BUZZ_MEDIA_BASE_URL = `https://${communityHost}/media`
  }
  if (ownerPubkey) {
    relayEnv.RELAY_OWNER_PUBKEY = ownerPubkey
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
          // Write requirepass to a config file (from an env var, not argv) so the
          // password never appears in the container's process list.
          command: [
            '/bin/sh',
            '-ec',
            'printf "appendonly yes\\ndir /data\\nrequirepass %s\\n" ' +
              '"$REDIS_PASSWORD" > /tmp/redis.conf\n' +
              'exec redis-server /tmp/redis.conf',
          ],
          env: { REDIS_PASSWORD: redisPassword },
        },
        ready: {
          display: i18n('Cache'),
          gracePeriod: 30_000,
          fn: () =>
            sdk.healthCheck.runHealthScript(
              // REDISCLI_AUTH from the config file the daemon wrote, so the poll
              // keeps the password off argv and skips redis-cli's -a warning.
              [
                '/bin/sh',
                '-c',
                'REDISCLI_AUTH="$(sed -n "s/^requirepass //p" /tmp/redis.conf)" ' +
                  'redis-cli ping',
              ],
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
              // Authenticate as root only to create the bucket and mint a
              // bucket-scoped service account; the relay itself never sees the
              // root credentials.
              `mc alias set local http://127.0.0.1:${minioPort} "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"`,
              'mc mb --ignore-existing "local/$BUZZ_S3_BUCKET"',
              'mc anonymous set none "local/$BUZZ_S3_BUCKET"',
              // Inline policy confining the relay's service account to the media
              // bucket. Re-derived every start so it tracks a bucket rename.
              'cat > /tmp/relay-policy.json <<EOF',
              '{',
              '  "Version": "2012-10-17",',
              '  "Statement": [',
              '    {',
              '      "Effect": "Allow",',
              '      "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:ListBucket","s3:GetBucketLocation"],',
              '      "Resource": ["arn:aws:s3:::$BUZZ_S3_BUCKET","arn:aws:s3:::$BUZZ_S3_BUCKET/*"]',
              '    }',
              '  ]',
              '}',
              'EOF',
              // Create on first run, refresh the policy on later runs. minio-init
              // is a oneshot that re-executes on every start, so this must be
              // idempotent.
              'if mc admin user svcacct info local "$BUZZ_S3_RELAY_ACCESS_KEY" >/dev/null 2>&1; then',
              '  mc admin user svcacct edit local "$BUZZ_S3_RELAY_ACCESS_KEY" --policy /tmp/relay-policy.json',
              'else',
              '  mc admin user svcacct add local "$MINIO_ROOT_USER" --access-key "$BUZZ_S3_RELAY_ACCESS_KEY" --secret-key "$BUZZ_S3_RELAY_SECRET_KEY" --policy /tmp/relay-policy.json',
              'fi',
            ].join('\n'),
          ],
          env: {
            MINIO_ROOT_USER: s3AccessKey,
            MINIO_ROOT_PASSWORD: s3SecretKey,
            BUZZ_S3_RELAY_ACCESS_KEY: s3RelayAccessKey,
            BUZZ_S3_RELAY_SECRET_KEY: s3RelaySecretKey,
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
            // Normalize ownership: the main volume starts root-owned, but after
            // the first boot the relay (uid 1000) owns everything it writes. The
            // git dir is (re)created and chowned non-recursively on every start
            // so a freshly-made /data/git is always relay-owned. A sentinel skips
            // the O(files) recursive chown of the whole volume on every
            // subsequent start, which would otherwise slow startup as /data/git
            // grows. Restore drops /data/.chowned to force a full re-chown of the
            // reintroduced root-owned files.
            'mkdir -p /data/git; ' +
              'chown 1000:1000 /data/git; ' +
              'if [ ! -e /data/.chowned ]; then ' +
              'chown -R 1000:1000 /data && touch /data/.chowned; ' +
              'fi',
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
