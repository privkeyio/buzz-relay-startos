import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'buzz-relay',
  title: 'Buzz Relay',
  license: 'Apache-2.0',
  packageRepo: 'https://github.com/privkeyio/buzz-relay-startos',
  upstreamRepo: 'https://github.com/block/buzz',
  marketingUrl: 'https://github.com/block/buzz',
  donationUrl: null,
  description: { short, long },
  volumes: ['main', 'postgres', 'redis', 'minio'],
  images: {
    'buzz-relay': {
      source: { dockerTag: 'ghcr.io/block/buzz:main' },
      arch: ['x86_64', 'aarch64'],
    },
    postgres: {
      source: { dockerTag: 'postgres:17-alpine' },
      arch: ['x86_64', 'aarch64'],
    },
    redis: {
      source: { dockerTag: 'redis:7-alpine' },
      arch: ['x86_64', 'aarch64'],
    },
    minio: {
      source: { dockerTag: 'minio/minio:RELEASE.2025-09-07T16-13-09Z' },
      arch: ['x86_64', 'aarch64'],
    },
    'minio-mc': {
      source: { dockerTag: 'minio/mc:RELEASE.2025-08-13T08-35-41Z' },
      arch: ['x86_64', 'aarch64'],
    },
  },
  dependencies: {},
})
