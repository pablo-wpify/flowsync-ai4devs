import { createHash } from 'node:crypto'
import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from '@japa/runner'
import {
  assertSafeTestDatabase,
  removeTestDatabaseFiles,
  resolvePath,
  UnsafeTestDatabaseError,
  withAuxiliaryFiles,
} from '#tests/support/test_database_guard'
import { acquireTestDatabaseLock, TestDatabaseLockedError } from '#tests/support/test_database_lock'

/**
 * Every case runs in its own disposable directory outside the project. A
 * disposable "witness" file plays the protected development database, so the
 * real development database is never involved.
 */
type Sandbox = {
  root: string
  authorized: string
  witness: string
  testDatabase: string
  fingerprint(path?: string): string
}

function createSandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'flowsync-test-db-'))
  const authorized = join(root, 'tmp')
  mkdirSync(authorized)
  const witness = join(authorized, 'db.sqlite3')
  writeFileSync(witness, `witness ${root}`)
  return {
    root,
    authorized,
    witness,
    testDatabase: join(authorized, 'db.test.sqlite3'),
    fingerprint: (path = witness) => createHash('sha256').update(readFileSync(path)).digest('hex'),
  }
}

function guardOptions(sandbox: Sandbox, configuredFilename: unknown) {
  return {
    inTest: true,
    connectionOpen: false,
    configuredFilename,
    authorizedDirectory: sandbox.authorized,
    protectedPaths: withAuxiliaryFiles(sandbox.witness),
  }
}

test.group('Test database guard on a disposable witness', (group) => {
  let sandbox: Sandbox
  let before: string

  group.each.setup(() => {
    sandbox = createSandbox()
    before = sandbox.fingerprint()
    return () => rmSync(sandbox.root, { recursive: true, force: true })
  })

  test('accepts the authorized path and does not create it', ({ assert }) => {
    assert.equal(
      assertSafeTestDatabase(guardOptions(sandbox, sandbox.testDatabase)),
      sandbox.testDatabase
    )
    assert.isFalse(existsSync(sandbox.testDatabase))
    assert.equal(sandbox.fingerprint(), before)
  })

  const dangerous: Array<
    [string, (sandbox: Sandbox) => unknown, Partial<{ inTest: boolean; connectionOpen: boolean }>?]
  > = [
    ['the same path as the protected database', (s) => s.witness],
    [
      'a path with ".." that reaches the protected database',
      (s) => join(s.authorized, 'sub', '..', 'db.sqlite3'),
    ],
    [
      'a symbolic link to the protected database',
      (s) => {
        symlinkSync(s.witness, s.testDatabase)
        return s.testDatabase
      },
    ],
    [
      'a file inside a directory that links outside the authorized one',
      (s) => {
        const outside = join(s.root, 'outside')
        mkdirSync(outside)
        symlinkSync(outside, join(s.authorized, 'linked'))
        return join(s.authorized, 'linked', 'db.test.sqlite3')
      },
    ],
    [
      'a hard link to the protected database',
      (s) => {
        linkSync(s.witness, s.testDatabase)
        return s.testDatabase
      },
    ],
    ['an unexpected file name', (s) => join(s.authorized, 'other.sqlite3')],
    ['the in-memory database', () => ':memory:'],
    ['the authorized path outside the test environment', (s) => s.testDatabase, { inTest: false }],
    [
      'the authorized path with the connection already open',
      (s) => s.testDatabase,
      { connectionOpen: true },
    ],
  ]

  for (const [name, configure, flags] of dangerous) {
    test(`refuses ${name} and leaves the witness untouched`, ({ assert }) => {
      const configuredFilename = configure(sandbox)
      assert.throws(
        () => assertSafeTestDatabase({ ...guardOptions(sandbox, configuredFilename), ...flags }),
        UnsafeTestDatabaseError
      )
      assert.equal(sandbox.fingerprint(), before)
    })
  }

  test('describes a dangling symbolic link as a link', ({ assert }) => {
    symlinkSync(join(sandbox.root, 'missing'), sandbox.testDatabase)
    const resolved = resolvePath(sandbox.testDatabase)
    assert.isTrue(resolved.exists)
    assert.isTrue(resolved.isSymbolicLink)
    assert.isNull(resolved.identity)
  })
})

test.group('Bounded deletion of test database files', (group) => {
  let sandbox: Sandbox
  let before: string

  group.each.setup(() => {
    sandbox = createSandbox()
    before = sandbox.fingerprint()
    return () => rmSync(sandbox.root, { recursive: true, force: true })
  })

  const remove = (box: Sandbox, lockHeld = true) =>
    removeTestDatabaseFiles({
      testDatabase: box.testDatabase,
      authorizedDirectory: box.authorized,
      protectedPaths: withAuxiliaryFiles(box.witness),
      lockHeld: () => lockHeld,
    })

  test('deletes the authorized database and its auxiliary files only', ({ assert }) => {
    writeFileSync(sandbox.testDatabase, 'old run')
    writeFileSync(`${sandbox.testDatabase}-journal`, 'old journal')
    writeFileSync(join(sandbox.authorized, 'unrelated.txt'), 'keep me')

    const removed = remove(sandbox)

    assert.sameMembers(removed, [sandbox.testDatabase, `${sandbox.testDatabase}-journal`])
    assert.isFalse(existsSync(sandbox.testDatabase))
    assert.isTrue(existsSync(join(sandbox.authorized, 'unrelated.txt')))
    assert.equal(sandbox.fingerprint(), before)
  })

  test('does nothing when there is no previous state', ({ assert }) => {
    assert.deepEqual(remove(sandbox), [])
    assert.equal(sandbox.fingerprint(), before)
  })

  test('refuses a symbolic link and deletes nothing', ({ assert }) => {
    symlinkSync(sandbox.witness, sandbox.testDatabase)
    assert.throws(() => remove(sandbox), UnsafeTestDatabaseError)
    assert.isTrue(lstatSync(sandbox.testDatabase).isSymbolicLink())
    assert.equal(sandbox.fingerprint(), before)
  })

  test('refuses a directory', ({ assert }) => {
    mkdirSync(sandbox.testDatabase)
    assert.throws(() => remove(sandbox), UnsafeTestDatabaseError)
    assert.isTrue(lstatSync(sandbox.testDatabase).isDirectory())
  })

  test('refuses a hard link to the protected database', ({ assert }) => {
    linkSync(sandbox.witness, sandbox.testDatabase)
    assert.throws(() => remove(sandbox), UnsafeTestDatabaseError)
    assert.isTrue(existsSync(sandbox.testDatabase))
    assert.equal(sandbox.fingerprint(), before)
  })

  test('checks every file before deleting any', ({ assert }) => {
    writeFileSync(sandbox.testDatabase, 'old run')
    symlinkSync(sandbox.witness, `${sandbox.testDatabase}-wal`)
    assert.throws(() => remove(sandbox), UnsafeTestDatabaseError)
    assert.isTrue(existsSync(sandbox.testDatabase), 'the main file must not be deleted')
    assert.equal(sandbox.fingerprint(), before)
  })

  test('refuses without the lock', ({ assert }) => {
    writeFileSync(sandbox.testDatabase, 'old run')
    assert.throws(() => remove(sandbox, false), UnsafeTestDatabaseError)
    assert.isTrue(existsSync(sandbox.testDatabase))
  })
})

test.group('Single test run lock', (group) => {
  let sandbox: Sandbox
  let lockPath: string

  group.each.setup(() => {
    sandbox = createSandbox()
    lockPath = `${sandbox.testDatabase}.lock`
    return () => rmSync(sandbox.root, { recursive: true, force: true })
  })

  test('takes the lock and releases it', ({ assert }) => {
    const lock = acquireTestDatabaseLock(lockPath, { pid: 4242, isAlive: () => false })
    assert.equal(readFileSync(lockPath, 'utf8').trim(), '4242')
    assert.isTrue(lock.isHeld())
    lock.release()
    assert.isFalse(lock.isHeld())
    assert.isFalse(existsSync(lockPath))
  })

  test('refuses while another live run holds it', ({ assert }) => {
    writeFileSync(lockPath, '1111\n')
    assert.throws(
      () => acquireTestDatabaseLock(lockPath, { pid: 2222, isAlive: () => true }),
      TestDatabaseLockedError
    )
    assert.equal(readFileSync(lockPath, 'utf8').trim(), '1111')
  })

  test('replaces a lock left by a process that no longer exists', ({ assert }) => {
    writeFileSync(lockPath, '1111\n')
    const lock = acquireTestDatabaseLock(lockPath, { pid: 2222, isAlive: () => false })
    assert.equal(readFileSync(lockPath, 'utf8').trim(), '2222')
    lock.release()
  })

  test('refuses a lock it cannot read the owner of', ({ assert }) => {
    writeFileSync(lockPath, 'not a pid')
    assert.throws(
      () => acquireTestDatabaseLock(lockPath, { pid: 2222, isAlive: () => false }),
      TestDatabaseLockedError
    )
  })

  test('refuses a lock path that is a symbolic link and leaves its target alone', ({ assert }) => {
    const before = sandbox.fingerprint()
    symlinkSync(sandbox.witness, lockPath)
    assert.throws(
      () => acquireTestDatabaseLock(lockPath, { pid: 2222, isAlive: () => false }),
      TestDatabaseLockedError
    )
    assert.equal(sandbox.fingerprint(), before)
  })

  test('does not remove a lock that now belongs to another run', ({ assert }) => {
    const lock = acquireTestDatabaseLock(lockPath, { pid: 2222, isAlive: () => false })
    writeFileSync(lockPath, '3333\n')
    lock.release()
    assert.equal(readFileSync(lockPath, 'utf8').trim(), '3333')
  })

  test('leaves no temporary files behind', ({ assert }) => {
    const lock = acquireTestDatabaseLock(lockPath, { pid: 2222, isAlive: () => false })
    lock.release()
    assert.deepEqual(
      readdirSync(sandbox.authorized).filter((name) => name.includes('.lock')),
      []
    )
  })

  test('refuses while another run is replacing an abandoned lock', ({ assert }) => {
    writeFileSync(lockPath, '1111\n')
    mkdirSync(`${lockPath}.reap`)
    assert.throws(
      () => acquireTestDatabaseLock(lockPath, { pid: 2222, isAlive: () => false }),
      TestDatabaseLockedError
    )
    assert.equal(readFileSync(lockPath, 'utf8').trim(), '1111')
  })

  test('does not replace a lock that another run took meanwhile', ({ assert }) => {
    writeFileSync(lockPath, '1111\n')
    // Simulates another run that replaces the abandoned lock right after this
    // run has seen it as abandoned and before it gets to replace it.
    const isAlive = (pid: number) => {
      if (pid === 1111) {
        writeFileSync(lockPath, '3333\n')
        return false
      }
      return true
    }
    assert.throws(
      () => acquireTestDatabaseLock(lockPath, { pid: 2222, isAlive }),
      TestDatabaseLockedError
    )
    assert.equal(readFileSync(lockPath, 'utf8').trim(), '3333')
    assert.isFalse(existsSync(`${lockPath}.reap`), 'the mutual exclusion directory is released')
  })
})
