import { lstatSync, realpathSync, statSync, unlinkSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

/**
 * Safety checks that keep the test runner away from the development database.
 *
 * Path resolution (which reads the file system) is kept separate from the
 * evaluation (which does not), so every rule can be tested with hand-built
 * descriptors. See openspec/changes/archive/2026-10-25-aislar-base-de-tests/design.md (D3, D8).
 */

export const TEST_DATABASE_FILENAME = 'db.test.sqlite3'

/**
 * Files SQLite may create next to a database, depending on its journal mode.
 */
export const SQLITE_AUXILIARY_SUFFIXES = ['-journal', '-wal', '-shm'] as const

export type FileIdentity = { dev: number; ino: number }

/**
 * What the file system says about a path. It describes; it never decides.
 */
export type ResolvedPath = {
  input: string
  /** Absolute and without "." or ".." segments. */
  absolute: string
  /** Symbolic links resolved on the longest existing ancestor. */
  real: string
  exists: boolean
  /** The last segment itself is a symbolic link (followed or dangling). */
  isSymbolicLink: boolean
  isRegularFile: boolean
  /** Device and inode of the file the path ends up at, when it exists. */
  identity: FileIdentity | null
}

export type TestDatabaseSafetyInput = {
  inTest: boolean
  connectionOpen: boolean
  configuredFilename: unknown
  /** Null when the configured filename is not a usable file path. */
  target: ResolvedPath | null
  authorizedDirectory: ResolvedPath
  protectedPaths: ResolvedPath[]
}

export class UnsafeTestDatabaseError extends Error {
  constructor(readonly reasons: string[]) {
    super(
      `Refusing to touch the test database; no database was opened, migrated or deleted:\n- ${reasons.join('\n- ')}`
    )
    this.name = 'UnsafeTestDatabaseError'
  }
}

function isMissingPathError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

/**
 * Resolves symbolic links on the longest existing ancestor and appends the
 * segments that do not exist yet, so a database that is not created yet still
 * gets a comparable real path.
 */
function realPathOf(absolute: string): string {
  const pending: string[] = []
  let current = absolute
  while (true) {
    try {
      return join(realpathSync(current), ...pending)
    } catch (error) {
      if (!isMissingPathError(error)) throw error
      const parent = dirname(current)
      if (parent === current) throw error
      pending.unshift(basename(current))
      current = parent
    }
  }
}

/**
 * Reads the file system to describe a path. Any error other than "does not
 * exist" propagates, so an unreadable path is never treated as absent.
 */
export function resolvePath(input: string): ResolvedPath {
  const absolute = resolve(input)

  let linkStats: ReturnType<typeof lstatSync> | null = null
  try {
    linkStats = lstatSync(absolute)
  } catch (error) {
    if (!isMissingPathError(error)) throw error
  }

  let targetStats: ReturnType<typeof statSync> | null = null
  if (linkStats) {
    try {
      targetStats = statSync(absolute)
    } catch (error) {
      // A dangling symbolic link has no target identity.
      if (!isMissingPathError(error)) throw error
    }
  }

  return {
    input,
    absolute,
    real: realPathOf(absolute),
    exists: linkStats !== null,
    isSymbolicLink: linkStats?.isSymbolicLink() ?? false,
    isRegularFile: linkStats?.isFile() ?? false,
    identity: targetStats ? { dev: targetStats.dev, ino: targetStats.ino } : null,
  }
}

function sameIdentity(a: FileIdentity | null, b: FileIdentity | null): boolean {
  return a !== null && b !== null && a.dev === b.dev && a.ino === b.ino
}

/**
 * Returns whether a configured value can be resolved as a database file path.
 */
export function isFilePathValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.trim() !== ':memory:'
}

/**
 * Decides whether the test database is safe to use. Reads nothing from the
 * file system: every fact comes in the input. Returns the reasons to refuse,
 * empty when it is safe.
 */
export function evaluateTestDatabaseSafety(input: TestDatabaseSafetyInput): string[] {
  const reasons: string[] = []

  if (!input.inTest) {
    reasons.push('the application is not running in the test environment')
  }
  if (input.connectionOpen) {
    reasons.push('the database connection was already open before the safety check')
  }
  if (!isFilePathValue(input.configuredFilename) || input.target === null) {
    reasons.push(
      `the configured database is not a file path: ${JSON.stringify(input.configuredFilename)}`
    )
    return reasons
  }

  const target = input.target
  if (basename(target.absolute) !== TEST_DATABASE_FILENAME) {
    reasons.push(
      `the test database file must be named ${TEST_DATABASE_FILENAME}: ${target.absolute}`
    )
  }
  if (dirname(target.real) !== input.authorizedDirectory.real) {
    reasons.push(
      `the test database must live in ${input.authorizedDirectory.real}, but resolves to ${target.real}`
    )
  }
  if (target.exists && target.isSymbolicLink) {
    reasons.push(`the test database is a symbolic link: ${target.absolute}`)
  } else if (target.exists && !target.isRegularFile) {
    reasons.push(`the test database is not a regular file: ${target.absolute}`)
  }

  for (const protectedPath of input.protectedPaths) {
    if (target.absolute === protectedPath.absolute || target.real === protectedPath.real) {
      reasons.push(`the test database resolves to a protected database: ${protectedPath.absolute}`)
    } else if (sameIdentity(target.identity, protectedPath.identity)) {
      reasons.push(`the test database is the same physical file as ${protectedPath.absolute}`)
    }
  }

  return reasons
}

/**
 * Resolves the configured database and throws unless it is safe. Returns the
 * absolute path of the authorized test database.
 */
export function assertSafeTestDatabase(options: {
  inTest: boolean
  connectionOpen: boolean
  configuredFilename: unknown
  authorizedDirectory: string
  protectedPaths: string[]
}): string {
  const target = isFilePathValue(options.configuredFilename)
    ? resolvePath(options.configuredFilename)
    : null

  const reasons = evaluateTestDatabaseSafety({
    inTest: options.inTest,
    connectionOpen: options.connectionOpen,
    configuredFilename: options.configuredFilename,
    target,
    authorizedDirectory: resolvePath(options.authorizedDirectory),
    protectedPaths: options.protectedPaths.map((path) => resolvePath(path)),
  })

  if (reasons.length > 0 || target === null) {
    throw new UnsafeTestDatabaseError(reasons)
  }
  return target.absolute
}

/**
 * The protected database plus the auxiliary files SQLite may keep next to it.
 */
export function withAuxiliaryFiles(databasePath: string): string[] {
  return [databasePath, ...SQLITE_AUXILIARY_SUFFIXES.map((suffix) => `${databasePath}${suffix}`)]
}

/**
 * Decides whether a file may be deleted. Reads nothing from the file system.
 */
export function evaluateDeletionTarget(input: {
  candidate: ResolvedPath
  allowedNames: string[]
  authorizedDirectory: ResolvedPath
  protectedPaths: ResolvedPath[]
  lockHeld: boolean
}): string[] {
  const { candidate } = input
  const reasons: string[] = []

  if (!input.lockHeld) {
    reasons.push('this run does not hold the test database lock')
  }
  if (!input.allowedNames.includes(basename(candidate.absolute))) {
    reasons.push(`not an authorized test database file: ${candidate.absolute}`)
  }
  if (dirname(candidate.real) !== input.authorizedDirectory.real) {
    reasons.push(`outside ${input.authorizedDirectory.real}: ${candidate.real}`)
  }
  if (!candidate.exists) {
    return reasons
  }
  if (candidate.isSymbolicLink) {
    reasons.push(`is a symbolic link: ${candidate.absolute}`)
  } else if (!candidate.isRegularFile) {
    reasons.push(`is not a regular file: ${candidate.absolute}`)
  }
  for (const protectedPath of input.protectedPaths) {
    if (
      candidate.real === protectedPath.real ||
      sameIdentity(candidate.identity, protectedPath.identity)
    ) {
      reasons.push(`is the same file as protected ${protectedPath.absolute}`)
    }
  }
  return reasons
}

/**
 * Deletes the authorized test database and its SQLite auxiliary files. Every
 * candidate is checked first; then each one is checked again right before it
 * is deleted. Any failed check aborts before deleting the remaining files.
 */
export function removeTestDatabaseFiles(options: {
  testDatabase: string
  authorizedDirectory: string
  protectedPaths: string[]
  lockHeld: () => boolean
}): string[] {
  const allowedNames = withAuxiliaryFiles(TEST_DATABASE_FILENAME)
  const candidates = withAuxiliaryFiles(resolve(options.testDatabase))

  const check = (candidatePath: string): ResolvedPath => {
    const candidate = resolvePath(candidatePath)
    const reasons = evaluateDeletionTarget({
      candidate,
      allowedNames,
      authorizedDirectory: resolvePath(options.authorizedDirectory),
      protectedPaths: options.protectedPaths.map((path) => resolvePath(path)),
      lockHeld: options.lockHeld(),
    })
    if (reasons.length > 0) {
      throw new UnsafeTestDatabaseError(reasons)
    }
    return candidate
  }

  candidates.forEach(check)

  const removed: string[] = []
  for (const candidatePath of candidates) {
    const candidate = check(candidatePath)
    if (candidate.exists) {
      unlinkSync(candidate.absolute)
      removed.push(candidate.absolute)
    }
  }
  return removed
}
