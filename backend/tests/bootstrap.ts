import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { dbAssertions } from '@adonisjs/lucid/plugins/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { authApiClient } from '@adonisjs/auth/plugins/api_client'
import { sessionApiClient } from '@adonisjs/session/plugins/api_client'
import type { Registry } from '../.adonisjs/client/registry/schema.d.ts'
import {
  assertSafeTestDatabase,
  removeTestDatabaseFiles,
  withAuxiliaryFiles,
} from '#tests/support/test_database_guard'
import { acquireTestDatabaseLock, type TestDatabaseLock } from '#tests/support/test_database_lock'

/**
 * This file is imported by the "bin/test.ts" entrypoint file
 */
declare module '@japa/api-client/types' {
  interface RoutesRegistry extends Registry {}
}

/**
 * This file is imported by the "bin/test.ts" entrypoint file
 */

/**
 * Configure Japa plugins in the plugins array.
 * Learn more - https://japa.dev/docs/runner-config#plugins-optional
 */
export const plugins: Config['plugins'] = [
  assert(),
  pluginAdonisJS(app),
  dbAssertions(app),
  apiClient(),
  sessionApiClient(app),
  authApiClient(app),
]

/**
 * The development database and its SQLite auxiliary files must never be
 * opened, migrated or deleted by a test run. The order of the setup hooks is
 * part of that guarantee: see openspec/changes/archive/2026-10-25-aislar-base-de-tests/design.md.
 */
const protectedDatabases = withAuxiliaryFiles(app.tmpPath('db.sqlite3'))
let testDatabase: string | undefined
let lock: TestDatabaseLock | undefined
let resetMigrations: (() => Promise<void>) | undefined

/**
 * Configure lifecycle function to run before and after all the
 * tests.
 *
 * The setup functions are executed before all the tests
 * The teardown functions are executed after all the tests
 */
export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [
    // 1. Safety check, before anything opens, deletes or migrates a database.
    async () => {
      const db = await app.container.make('lucid.db')
      const connection = db.manager.get(db.primaryConnectionName)
      const { filename } = (connection?.config.connection ?? {}) as { filename?: unknown }
      testDatabase = assertSafeTestDatabase({
        inTest: app.inTest,
        connectionOpen: db.manager.isConnected(db.primaryConnectionName),
        configuredFilename: filename,
        authorizedDirectory: app.tmpPath(),
        protectedPaths: protectedDatabases,
      })
    },
    // 2. A single run at a time.
    () => {
      lock = acquireTestDatabaseLock(`${testDatabase}.lock`)
    },
    // 3. Start from a known state, deleting only the authorized files.
    () => {
      removeTestDatabaseFiles({
        testDatabase: testDatabase!,
        authorizedDirectory: app.tmpPath(),
        protectedPaths: protectedDatabases,
        lockHeld: () => lock?.isHeld() ?? false,
      })
    },
    // 4. Migrate without regenerating database/schema.ts.
    async () => {
      resetMigrations = await testUtils.db().migrate()
    },
  ],
  teardown: [
    // Roll the migrations back but keep the test database file.
    async () => {
      await resetMigrations?.()
    },
    // Close every connection before another run may take the lock.
    async () => {
      const db = await app.container.make('lucid.db')
      await db.manager.closeAll()
      lock?.release()
    },
  ],
}

/**
 * Configure suites by tapping into the test suite instance.
 * Learn more - https://japa.dev/docs/test-suites#lifecycle-hooks
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}
