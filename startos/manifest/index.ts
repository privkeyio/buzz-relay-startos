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
  volumes: ['main'],
  images: {
    'buzz-relay': {
      source: { dockerTag: 'ghcr.io/block/buzz:main' },
      arch: ['x86_64', 'aarch64'],
    },
  },
  dependencies: {},
})
