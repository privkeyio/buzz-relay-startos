import { sdk } from './sdk'
import * as fs from 'fs/promises'

export const { createBackup, restoreInit } = sdk.setupBackups(async () =>
  sdk.Backups.ofVolumes('main', 'postgres', 'redis', 'minio').setPostRestore(
    async () => {
      // Restore rsyncs the backup's files back root-owned and reinstates the
      // /data/.chowned sentinel, which would make prepare-data skip the chown
      // and leave the relay (uid 1000) unable to read its own data. Drop the
      // sentinel so the next start performs the full recursive re-chown.
      await fs.rm('/media/startos/volumes/main/.chowned', { force: true })
    },
  ),
)
