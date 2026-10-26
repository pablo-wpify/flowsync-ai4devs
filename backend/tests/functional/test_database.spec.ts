import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import User from '#models/user'
import { assertSafeTestDatabase, withAuxiliaryFiles } from '#tests/support/test_database_guard'

test.group('Test database', (group) => {
  // Every test runs inside a transaction that is rolled back afterwards.
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the active connection uses the exclusive test database', ({ assert }) => {
    const connection = db.manager.get(db.primaryConnectionName)
    const { filename } = (connection?.config.connection ?? {}) as { filename?: unknown }

    assert.equal(filename, app.tmpPath('db.test.sqlite3'))
    assert.notEqual(filename, app.tmpPath('db.sqlite3'))
    // Path rules only: the connection is legitimately open by now.
    assert.equal(
      assertSafeTestDatabase({
        inTest: app.inTest,
        connectionOpen: false,
        configuredFilename: filename,
        authorizedDirectory: app.tmpPath(),
        protectedPaths: withAuxiliaryFiles(app.tmpPath('db.sqlite3')),
      }),
      app.tmpPath('db.test.sqlite3')
    )
  })

  test('a synthetic user can log in and read a protected route', async ({ client, assert }) => {
    const email = 'functional-login@example.test'
    const password = 'Synthetic-Pass-123'
    await User.create({ fullName: null, email, password })

    const login = await client.post('/api/v1/auth/login').json({ email, password })
    login.assertStatus(200)
    const token = login.body().data.token as string
    assert.isString(token)

    const profile = await client.get('/api/v1/account/profile').bearerToken(token)
    profile.assertStatus(200)
    assert.equal(profile.body().data.email, email)

    const anonymous = await client.get('/api/v1/account/profile')
    anonymous.assertStatus(401)
  })

  test('isolation: a test creates a record', async ({ assert }) => {
    await User.create({
      fullName: null,
      email: 'isolation@example.test',
      password: 'Synthetic-Pass-123',
    })
    assert.isNotNull(await User.findBy('email', 'isolation@example.test'))
  })

  test('isolation: the next test does not see that record', async ({ assert }) => {
    assert.isNull(await User.findBy('email', 'isolation@example.test'))
    assert.isNull(await User.findBy('email', 'functional-login@example.test'))
  })
})
