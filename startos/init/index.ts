import { sdk } from '../sdk'
import { setDependencies } from '../dependencies'
import { setInterfaces } from '../interfaces'
import { versionGraph } from '../versions'
import { actions } from '../actions'
import { restoreInit } from '../backups'
import { seedFiles } from './seedFiles'

const inits = [
  restoreInit,
  versionGraph,
  seedFiles,
  setInterfaces,
  setDependencies,
  actions,
]

const once = <T>(fn: () => T) => {
  let called = false
  let value: T
  return () => {
    if (!called) {
      called = true
      value = fn()
    }
    return value
  }
}

// Composes the init handlers the same way sdk.setupInit does, minus its final
// progress flush. That flush (FullProgressTracker.sync) busy-waits on an
// inFlight promise that is never cleared, pinning a core and hanging the
// install forever. This package registers no progress phases, so the tracker
// has nothing to report and is passed as undefined.
export const init = async (opts: {
  effects: Record<string, any>
  kind: 'install' | 'update' | 'restore' | null
}) => {
  for (const idx in inits) {
    const entry = inits[idx] as any
    const fn = async (): Promise<void> => {
      let res = () => {}
      const complete = new Promise<void>((resolve) => {
        res = resolve
      })
      const effects = opts.effects.child(`init_${idx}`)
      effects.constRetry = once(() =>
        complete.then(() => fn()).catch(console.error),
      )
      try {
        if ('init' in entry) await entry.init(effects, opts.kind, undefined)
        else await entry(effects, opts.kind, undefined)
      } finally {
        res()
      }
    }
    await fn()
  }
}

export const uninit = sdk.setupUninit(versionGraph)
