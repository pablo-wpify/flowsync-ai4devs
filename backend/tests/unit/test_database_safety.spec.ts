import { test } from '@japa/runner'
import {
  evaluateDeletionTarget,
  evaluateTestDatabaseSafety,
  type ResolvedPath,
  type TestDatabaseSafetyInput,
} from '#tests/support/test_database_guard'

/**
 * The evaluation reads nothing from the file system, so every rule is tested
 * with hand-built descriptors.
 */
function descriptor(path: string, overrides: Partial<ResolvedPath> = {}): ResolvedPath {
  return {
    input: path,
    absolute: path,
    real: path,
    exists: false,
    isSymbolicLink: false,
    isRegularFile: false,
    identity: null,
    ...overrides,
  }
}

const authorizedDirectory = descriptor('/app/tmp', { exists: true })
const developmentDatabase = descriptor('/app/tmp/db.sqlite3', {
  exists: true,
  isRegularFile: true,
  identity: { dev: 1, ino: 100 },
})
const testDatabase = descriptor('/app/tmp/db.test.sqlite3')

function safeInput(overrides: Partial<TestDatabaseSafetyInput> = {}): TestDatabaseSafetyInput {
  return {
    inTest: true,
    connectionOpen: false,
    configuredFilename: testDatabase.absolute,
    target: testDatabase,
    authorizedDirectory,
    protectedPaths: [developmentDatabase],
    ...overrides,
  }
}

test.group('Test database safety evaluation', () => {
  test('accepts the authorized test database', ({ assert }) => {
    assert.deepEqual(evaluateTestDatabaseSafety(safeInput()), [])
  })

  test('accepts an existing regular test database file', ({ assert }) => {
    const existing = descriptor(testDatabase.absolute, {
      exists: true,
      isRegularFile: true,
      identity: { dev: 1, ino: 200 },
    })
    assert.deepEqual(evaluateTestDatabaseSafety(safeInput({ target: existing })), [])
  })

  test('rejects running outside the test environment', ({ assert }) => {
    const reasons = evaluateTestDatabaseSafety(safeInput({ inTest: false }))
    assert.lengthOf(reasons, 1)
    assert.match(reasons[0], /not running in the test environment/)
  })

  test('rejects a connection opened before the check', ({ assert }) => {
    const reasons = evaluateTestDatabaseSafety(safeInput({ connectionOpen: true }))
    assert.lengthOf(reasons, 1)
    assert.match(reasons[0], /already open/)
  })

  for (const value of [':memory:', '', '   ', undefined, 42]) {
    test(`rejects a configured value that is not a file path: ${JSON.stringify(value)}`, ({
      assert,
    }) => {
      const reasons = evaluateTestDatabaseSafety(
        safeInput({ configuredFilename: value, target: null })
      )
      assert.lengthOf(reasons, 1)
      assert.match(reasons[0], /not a file path/)
    })
  }

  test('rejects an unexpected file name', ({ assert }) => {
    const other = descriptor('/app/tmp/other.sqlite3')
    const reasons = evaluateTestDatabaseSafety(
      safeInput({ configuredFilename: other.absolute, target: other })
    )
    assert.lengthOf(reasons, 1)
    assert.match(reasons[0], /must be named db\.test\.sqlite3/)
  })

  test('rejects a test database that resolves outside the authorized directory', ({ assert }) => {
    const linked = descriptor('/app/tmp/linked/db.test.sqlite3', {
      real: '/elsewhere/db.test.sqlite3',
    })
    const reasons = evaluateTestDatabaseSafety(
      safeInput({ configuredFilename: linked.absolute, target: linked })
    )
    assert.lengthOf(reasons, 1)
    assert.match(reasons[0], /must live in \/app\/tmp/)
  })

  test('rejects a test database that is a symbolic link', ({ assert }) => {
    const link = descriptor(testDatabase.absolute, {
      exists: true,
      isSymbolicLink: true,
      identity: { dev: 1, ino: 300 },
    })
    const reasons = evaluateTestDatabaseSafety(safeInput({ target: link }))
    assert.isTrue(reasons.some((reason) => /symbolic link/.test(reason)))
  })

  test('rejects a test database that is not a regular file', ({ assert }) => {
    const directory = descriptor(testDatabase.absolute, { exists: true, isRegularFile: false })
    const reasons = evaluateTestDatabaseSafety(safeInput({ target: directory }))
    assert.isTrue(reasons.some((reason) => /not a regular file/.test(reason)))
  })

  test('rejects the development database path', ({ assert }) => {
    const reasons = evaluateTestDatabaseSafety(
      safeInput({ configuredFilename: developmentDatabase.absolute, target: developmentDatabase })
    )
    assert.isTrue(reasons.some((reason) => /resolves to a protected database/.test(reason)))
  })

  test('rejects a path whose real path is the development database', ({ assert }) => {
    const link = descriptor(testDatabase.absolute, {
      exists: true,
      isSymbolicLink: true,
      real: developmentDatabase.real,
      identity: developmentDatabase.identity,
    })
    const reasons = evaluateTestDatabaseSafety(safeInput({ target: link }))
    assert.isTrue(reasons.some((reason) => /resolves to a protected database/.test(reason)))
  })

  test('rejects another name for the same physical file', ({ assert }) => {
    const hardLink = descriptor(testDatabase.absolute, {
      exists: true,
      isRegularFile: true,
      identity: developmentDatabase.identity,
    })
    const reasons = evaluateTestDatabaseSafety(safeInput({ target: hardLink }))
    assert.lengthOf(reasons, 1)
    assert.match(reasons[0], /same physical file/)
  })

  test('compares paths with the case the file system reports', ({ assert }) => {
    const otherCase = descriptor('/app/tmp/DB.TEST.SQLITE3')
    const reasons = evaluateTestDatabaseSafety(
      safeInput({ configuredFilename: otherCase.absolute, target: otherCase })
    )
    assert.lengthOf(reasons, 1)
    assert.match(reasons[0], /must be named db\.test\.sqlite3/)
  })
})

test.group('Test database deletion evaluation', () => {
  const allowedNames = ['db.test.sqlite3', 'db.test.sqlite3-journal']
  const deletionInput = (candidate: ResolvedPath, lockHeld = true) => ({
    candidate,
    allowedNames,
    authorizedDirectory,
    protectedPaths: [developmentDatabase],
    lockHeld,
  })
  const regular = descriptor('/app/tmp/db.test.sqlite3', {
    exists: true,
    isRegularFile: true,
    identity: { dev: 1, ino: 400 },
  })

  test('allows deleting the authorized regular file while holding the lock', ({ assert }) => {
    assert.deepEqual(evaluateDeletionTarget(deletionInput(regular)), [])
  })

  test('allows a missing authorized file (nothing to delete)', ({ assert }) => {
    assert.deepEqual(evaluateDeletionTarget(deletionInput(testDatabase)), [])
  })

  test('refuses without the lock', ({ assert }) => {
    const reasons = evaluateDeletionTarget(deletionInput(regular, false))
    assert.lengthOf(reasons, 1)
    assert.match(reasons[0], /does not hold the test database lock/)
  })

  test('refuses a file that is not authorized', ({ assert }) => {
    const other = descriptor('/app/tmp/db.sqlite3-wal', { exists: true, isRegularFile: true })
    const reasons = evaluateDeletionTarget(deletionInput(other))
    assert.isTrue(reasons.some((reason) => /not an authorized test database file/.test(reason)))
  })

  test('refuses a symbolic link', ({ assert }) => {
    const link = descriptor(regular.absolute, { exists: true, isSymbolicLink: true })
    const reasons = evaluateDeletionTarget(deletionInput(link))
    assert.isTrue(reasons.some((reason) => /symbolic link/.test(reason)))
  })

  test('refuses something that is not a regular file', ({ assert }) => {
    const directory = descriptor(regular.absolute, { exists: true })
    const reasons = evaluateDeletionTarget(deletionInput(directory))
    assert.isTrue(reasons.some((reason) => /not a regular file/.test(reason)))
  })

  test('refuses the same physical file as a protected database', ({ assert }) => {
    const hardLink = descriptor(regular.absolute, {
      exists: true,
      isRegularFile: true,
      identity: developmentDatabase.identity,
    })
    const reasons = evaluateDeletionTarget(deletionInput(hardLink))
    assert.isTrue(reasons.some((reason) => /same file as protected/.test(reason)))
  })

  test('refuses a file that resolves outside the authorized directory', ({ assert }) => {
    const outside = descriptor(regular.absolute, {
      exists: true,
      isRegularFile: true,
      real: '/elsewhere/db.test.sqlite3',
    })
    const reasons = evaluateDeletionTarget(deletionInput(outside))
    assert.isTrue(reasons.some((reason) => /outside \/app\/tmp/.test(reason)))
  })
})
