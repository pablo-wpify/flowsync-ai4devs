import { readFileSync, writeFileSync } from 'node:fs'
import {
  acquireTestDatabaseLock,
  type TestDatabaseLock,
  type TestDatabaseLockHooks,
} from '#tests/support/test_database_lock'

/**
 * Child process used by the lock concurrency tests. It only acts on paths
 * the parent passes, always inside a disposable directory.
 *
 * Protocol (IPC):
 *  - sends { type: 'ready' } once started;
 *  - on 'go' tries to acquire the lock. If the parent chose a pause point,
 *    on reaching it the worker creates `arrivedPath` and blocks reading the
 *    FIFO at `gatePath` until the parent writes to it;
 *  - sends { type: 'acquired' } or { type: 'refused', error };
 *  - on 'release' releases the lock, sends { type: 'released' } and exits.
 */

const [lockPath, pausePoint, arrivedPath, gatePath] = process.argv.slice(2)
let lock: TestDatabaseLock | undefined

function send(message: Record<string, unknown>, then?: () => void) {
  process.send!(message, undefined, undefined, () => then?.())
}

function pause() {
  writeFileSync(arrivedPath, `${process.pid}\n`)
  // Blocks until the parent opens the FIFO and writes: no polling, no sleep.
  readFileSync(gatePath)
}

process.on('message', (message) => {
  if (message === 'go') {
    const hooks: TestDatabaseLockHooks =
      pausePoint === 'beforeCreate' || pausePoint === 'insideReplace' ? { [pausePoint]: pause } : {}
    try {
      lock = acquireTestDatabaseLock(lockPath, { hooks })
      send({ type: 'acquired', pid: process.pid })
    } catch (error) {
      send({ type: 'refused', error: (error as Error).name }, () => process.exit(0))
    }
  } else if (message === 'release') {
    lock?.release()
    send({ type: 'released' }, () => process.exit(0))
  }
})

send({ type: 'ready' })
