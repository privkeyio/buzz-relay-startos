import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { relayPort } from '../utils'

// Buzz Desktop has no logging and collapses TLS failures, closed ports, and a
// host mismatch into a single opaque "could not connect" / "relay returned 404".
// This action compensates from the StartOS side: it surfaces the exact wss://
// address to add, the community host the relay is bound to, which public domains
// are actually attached to the interface (i.e. which have a managed clearnet
// certificate), and a plain-language readiness verdict.
export const diagnostics = sdk.Action.withoutInput(
  'diagnostics',

  async () => ({
    name: i18n('Diagnostics'),
    description: i18n(
      'Show the address to add in Buzz Desktop and the current community and interface state.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  async ({ effects }) => {
    const store = await storeJson.read().once()
    const communityHost = store?.communityHost ?? null
    const boundHost = store?.boundHost ?? null
    // The host the relay actually serves: boundHost once first start has locked
    // it, otherwise the pending communityHost from config.
    const activeHost = boundHost ?? communityHost

    // Read the public domains attached to the exported UI interface. A public
    // domain here means StartOS is managing a clearnet (e.g. Let's Encrypt)
    // certificate for it — the one thing Buzz Desktop's webpki-only client will
    // trust. Empty while stopped or before any domain is added.
    const host = await sdk.host.getOwn(effects, 'ui-multi').once()
    const addr = host?.bindings[relayPort]?.interfaces['ui']?.addressInfo
    const publicDomains = addr
      ? addr.public.filter({ kind: 'domain' }).format('url').map((u) => u.hostname)
      : []

    const addressValue = activeHost
      ? `wss://${activeHost}`
      : 'Not configured — set Community Host in the Configuration action first.'

    const hostValue = communityHost
      ? boundHost
        ? `${communityHost} (locked — bound at first start)`
        : `${communityHost} (not yet started; still editable)`
      : 'Not set'

    const domainsValue = publicDomains.length
      ? publicDomains.join(', ')
      : 'None attached'

    let readiness: string
    if (!activeHost) {
      readiness =
        'Community Host is not set. Open the Configuration action, set it to your public clearnet domain, then start.'
    } else if (publicDomains.includes(activeHost)) {
      readiness = `Ready — "${activeHost}" is attached to this interface as a public domain, so StartOS is managing a clearnet certificate for it. Add wss://${activeHost} in Buzz Desktop.`
    } else if (publicDomains.length) {
      readiness = `Mismatch — Community Host is "${activeHost}" but the interface's public domain(s) are: ${publicDomains.join(', ')}. Add "${activeHost}" to this service's interface with Let's Encrypt so its certificate is issued, or the host Buzz Desktop connects to will not match the community.`
    } else {
      readiness = `Not ready — no public clearnet domain is attached to this interface. Buzz Desktop only trusts public certificate authorities, so add "${activeHost}" as a domain with Let's Encrypt and make port 443 publicly reachable. Until then, add-community fails with a generic error.`
    }

    return {
      version: '1',
      title: i18n('Diagnostics'),
      message: i18n(
        'Add your community in Buzz Desktop using the address below. If no public clearnet domain is attached to the interface, Buzz Desktop cannot connect.',
      ),
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: i18n('Add This Community in Buzz Desktop'),
            description: null,
            value: addressValue,
            masked: false,
            copyable: true,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Community Host'),
            description: null,
            value: hostValue,
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Public Domains on Interface'),
            description: null,
            value: domainsValue,
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Connection Readiness'),
            description: null,
            value: readiness,
            masked: false,
            copyable: false,
            qr: false,
          },
        ],
      },
    }
  },
)
