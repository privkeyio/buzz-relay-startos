import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, Value } = sdk

export const inputSpec = InputSpec.of({
  confirmHost: Value.text({
    name: i18n('Confirm Community Host'),
    description: i18n(
      'Type your community host exactly as configured to confirm. This is the last safeguard against an accidental reset — the value you type must match the host this community is bound to.',
    ),
    required: true,
    default: null,
    placeholder: 'buzz1.privkey.io',
  }),
})

// Upstream permanently binds the community to RELAY_URL's host on first start
// and has no rename/re-point path (communities is keyed on UNIQUE lower(host);
// buzz-admin has no set-host). The only recovery from a wrong host — or a
// corrupted database — is to wipe Postgres and let the relay re-seed on next
// boot. This action does exactly that and releases the boundHost lock so the
// operator can pick a new domain in the Configuration action instead of
// reinstalling the whole package.
export const reset = sdk.Action.withInput(
  'reset',

  async () => ({
    name: i18n('Reset Community'),
    description: i18n(
      'Erase this community and start over — recover after binding the wrong domain, or reset a corrupted database.',
    ),
    warning: i18n(
      'This permanently deletes the entire community: every channel, member, post, and NIP-05 identity. It wipes the database and releases the host lock so you can set a new domain. This cannot be undone. Stop Buzz Relay before running it, then reconfigure and start to seed a fresh community.',
    ),
    allowedStatuses: 'only-stopped',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async () => ({ confirmHost: '' }),

  async ({ effects, input }) => {
    const store = await storeJson.read().once()
    // boundHost is the host actually seeded into Postgres; communityHost is the
    // pending config value before first start. Reset targets whichever the
    // community is (or would be) bound to.
    const target = store?.boundHost ?? store?.communityHost ?? null
    if (!target) {
      throw new Error(
        'Nothing to reset — no Community Host has been configured yet. ' +
          'Set one in the Configuration action first.',
      )
    }

    const confirmed = input.confirmHost.trim().toLowerCase()
    if (confirmed !== target) {
      throw new Error(
        `Confirmation does not match. Type "${target}" exactly to confirm you ` +
          'want to permanently erase this community.',
      )
    }

    // Clear the Postgres volume so the entrypoint runs a fresh initdb and the
    // relay re-seeds its community on next start. The action is only-stopped, so
    // no daemon holds the volume while we remove its contents. Removing the
    // volume's children (rather than the mountpoint itself) keeps the mount
    // intact. ENOENT means the volume was never populated — treat as empty.
    const pgRoot = sdk.volumes.postgres.subpath('')
    try {
      const entries = await readdir(pgRoot)
      await Promise.all(
        entries.map((entry) =>
          rm(join(pgRoot, entry), { recursive: true, force: true }),
        ),
      )
    } catch (e: any) {
      if (e?.code !== 'ENOENT') throw e
    }

    // Release the host lock. main.ts rebinds boundHost from communityHost on the
    // next start, and the Configuration action unlocks host edits once boundHost
    // is null — so the operator can now move to a different domain.
    await storeJson.merge(effects, { boundHost: null })

    return {
      version: '1',
      title: i18n('Community Reset'),
      message: i18n(
        'The community database was erased and the host lock released. Open the Configuration action to set your new Community Host (or keep the current one), then start Buzz Relay to seed a fresh community.',
      ),
      result: null,
    }
  },
)
