import { randomUUID } from 'node:crypto'
import {
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'

/**
 * Ensures a single test run prepares or uses the test database at a time.
 * See openspec/changes/archive/2026-10-25-aislar-base-de-tests/design.md (D7).
 */

export class TestDatabaseLockedError extends Error {
  constructor(
    readonly lockPath: string,
    readonly ownerPid: number | null,
    detail?: string
  ) {
    super(
      detail ??
        (ownerPid === null
          ? `The test database lock ${lockPath} exists but its owner cannot be determined. Nothing was deleted or migrated. Check that no other test run is active and remove the file by hand.`
          : `Another test run (process ${ownerPid}) holds ${lockPath}. Nothing was deleted or migrated. If that process is not a test run, remove the file by hand.`)
    )
    this.name = 'TestDatabaseLockedError'
  }
}

export type TestDatabaseLock = {
  path: string
  isHeld(): boolean
  release(): void
}

/**
 * A process exists when signal 0 can be sent to it. EPERM also means it
 * exists, just owned by someone else.
 */
export function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | null)?.code
}

/**
 * Creates the lock with its content already in place: the owner is written
 * to a private temporary file, which is then hard-linked to the lock path.
 * Linking fails when any entry with that name exists (a symbolic link
 * included, without following it), so a lock is never seen empty.
 */
/**
 * Points where the concurrency tests pause a real process to force the worst
 * interleaving. Not used outside tests.
 */
export type TestDatabaseLockHooks = {
  /** Right before the atomic creation of the lock. */
  beforeCreate?: () => void
  /** Inside the critical section that replaces an abandoned lock. */
  insideReplace?: () => void
}

function tryCreate(lockPath: string, pid: number, hooks: TestDatabaseLockHooks = {}): boolean {
  const temporary = `${lockPath}.${pid}.${randomUUID()}.tmp`
  writeFileSync(temporary, `${pid}\n`, { flag: 'wx', mode: 0o600 })
  try {
    hooks.beforeCreate?.()
    linkSync(temporary, lockPath)
    return true
  } catch (error) {
    if (errorCode(error) === 'EEXIST') return false
    throw error
  } finally {
    unlinkSync(temporary)
  }
}

/**
 * Reads the owner of an existing lock: its process id, null when the entry is
 * not a regular file or holds no valid process id, or undefined when the lock
 * no longer exists.
 */
function readOwner(lockPath: string): number | null | undefined {
  try {
    if (!lstatSync(lockPath).isFile()) return null
    const owner = Number(readFileSync(lockPath, 'utf8').trim())
    return Number.isInteger(owner) && owner > 0 ? owner : null
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined
    throw error
  }
}

/**
 * Replaces a lock abandoned by a process that no longer exists. Runs inside
 * a mutual exclusion directory, so two runs never replace it at the same
 * time, and re-reads the owner inside it: if the lock changed meanwhile,
 * another run took it and this one gives up.
 *
 * Returns true when this run now holds the lock, false when the lock
 * disappeared and acquisition should be retried.
 */
function replaceAbandonedLock(
  lockPath: string,
  abandonedOwner: number,
  pid: number,
  hooks: TestDatabaseLockHooks
): boolean {
  const mutex = `${lockPath}.reap`
  try {
    mkdirSync(mutex)
  } catch (error) {
    if (errorCode(error) !== 'EEXIST') throw error
    throw new TestDatabaseLockedError(
      lockPath,
      abandonedOwner,
      `Another test run is replacing the abandoned lock ${lockPath}. Nothing was deleted or migrated. If no test run is active, remove ${mutex} by hand.`
    )
  }
  try {
    hooks.insideReplace?.()
    const current = readOwner(lockPath)
    if (current === undefined) return false
    if (current !== abandonedOwner) throw new TestDatabaseLockedError(lockPath, current)
    unlinkSync(lockPath)
    if (!tryCreate(lockPath, pid)) {
      throw new TestDatabaseLockedError(lockPath, readOwner(lockPath) ?? null)
    }
    return true
  } finally {
    rmdirSync(mutex)
  }
}

export function acquireTestDatabaseLock(
  lockPath: string,
  options: {
    pid?: number
    isAlive?: (pid: number) => boolean
    hooks?: TestDatabaseLockHooks
  } = {}
): TestDatabaseLock {
  const pid = options.pid ?? process.pid
  const isAlive = options.isAlive ?? processIsAlive
  const hooks = options.hooks ?? {}

  let acquired = false
  // A lock released between our attempt and our read is retried a few times.
  for (let attempt = 0; attempt < 3 && !acquired; attempt++) {
    if (tryCreate(lockPath, pid, hooks)) {
      acquired = true
      break
    }
    const owner = readOwner(lockPath)
    if (owner === undefined) continue
    if (owner === null || isAlive(owner)) {
      throw new TestDatabaseLockedError(lockPath, owner)
    }
    acquired = replaceAbandonedLock(lockPath, owner, pid, hooks)
  }
  if (!acquired) {
    throw new TestDatabaseLockedError(lockPath, readOwner(lockPath) ?? null)
  }

  let held = true
  const release = () => {
    if (!held) return
    held = false
    process.removeListener('exit', release)
    try {
      if (readOwner(lockPath) === pid) unlinkSync(lockPath)
    } catch {
      // Runs from the process "exit" handler too: never throw from here.
    }
  }
  process.on('exit', release)

  return { path: lockPath, isHeld: () => held, release }
}
