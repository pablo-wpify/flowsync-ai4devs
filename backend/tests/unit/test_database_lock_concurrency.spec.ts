import { type ChildProcess, execFileSync, fork, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  watch,
  writeFileSync,
} from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from '@japa/runner'
import { processIsAlive } from '#tests/support/test_database_lock'

/**
 * Real processes race for the lock in a disposable directory. A start barrier
 * releases them together, and a pause point inside the lock code holds each
 * process until the parent has seen every process either reach it or be
 * refused. That forces the worst interleaving deterministically, without
 * sleeps: the processes block on FIFOs, the parent reacts to file events.
 */

const backendRoot = fileURLToPath(new URL('../../', import.meta.url))
const workerPath = fileURLToPath(
  new URL('../support/test_database_lock_worker.ts', import.meta.url)
)

type Result = { type: 'acquired' | 'refused'; pid?: number; error?: string }

type RoundReport = {
  arrivals: number
  acquired: number[]
  refused: string[]
  lockOwnerWhileHeld: number | null
  exitCodes: Array<number | null>
  survivors: number[]
  leftovers: string[]
}

const spawned: ChildProcess[] = []
const directories: string[] = []

function once<T>(child: ChildProcess, predicate: (message: any) => T | undefined): Promise<T> {
  return new Promise((resolve, reject) => {
    const onMessage = (message: unknown) => {
      const value = predicate(message)
      if (value !== undefined) {
        child.off('message', onMessage)
        resolve(value)
      }
    }
    child.on('message', onMessage)
    child.once('exit', (code) => reject(new Error(`worker exited early with code ${code}`)))
  })
}

async function runRound(options: {
  workers: number
  pausePoint: 'beforeCreate' | 'insideReplace'
  abandonedOwner?: number
}): Promise<RoundReport> {
  const root = mkdtempSync(join(tmpdir(), 'flowsync-lock-race-'))
  directories.push(root)
  const lockPath = join(root, 'db.test.sqlite3.lock')
  if (options.abandonedOwner) writeFileSync(lockPath, `${options.abandonedOwner}\n`)

  const arrivedResolvers = new Map<string, () => void>()
  const watcher = watch(root, (_event, filename) => {
    if (filename) arrivedResolvers.get(filename.toString())?.()
  })

  const workers = Array.from({ length: options.workers }, (_, index) => {
    const gate = join(root, `gate-${index}`)
    const arrivedName = `arrived-${index}`
    execFileSync('mkfifo', [gate])
    const child = fork(workerPath, [lockPath, options.pausePoint, join(root, arrivedName), gate], {
      cwd: backendRoot,
      execArgv: ['--import', '@poppinss/ts-exec'],
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    })
    spawned.push(child)
    const exited = new Promise<number | null>((resolve) => child.once('exit', resolve))
    const ready = once(child, (message) => (message?.type === 'ready' ? true : undefined))
    const result = once<Result>(child, (message) =>
      message?.type === 'acquired' || message?.type === 'refused' ? message : undefined
    )
    const arrived = new Promise<void>((resolve) => arrivedResolvers.set(arrivedName, resolve))
    return { child, gate, arrivedName, exited, ready, result, arrived }
  })

  try {
    // Start barrier: every process is up before any of them tries.
    await Promise.all(workers.map((worker) => worker.ready))
    workers.forEach((worker) => worker.child.send('go'))

    // Hold the processes at the pause point until each one has either
    // reached it or been refused.
    await Promise.all(workers.map((worker) => Promise.race([worker.arrived, worker.result])))
    const arrivals = workers.filter((worker) => existsSync(join(root, worker.arrivedName)))

    // Open the gates of the processes that reached the pause point.
    await Promise.all(arrivals.map((worker) => writeFile(worker.gate, 'go')))

    const results = await Promise.all(workers.map((worker) => worker.result))
    const acquired = results.filter((r) => r.type === 'acquired').map((r) => r.pid!)
    const refused = results.filter((r) => r.type === 'refused').map((r) => r.error!)
    const lockOwnerWhileHeld = existsSync(lockPath)
      ? Number(readFileSync(lockPath, 'utf8').trim())
      : null

    for (const worker of workers) {
      if (worker.child.connected) worker.child.send('release')
    }
    const exitCodes = await Promise.all(workers.map((worker) => worker.exited))

    return {
      arrivals: arrivals.length,
      acquired,
      refused,
      lockOwnerWhileHeld,
      exitCodes,
      survivors: workers.map((worker) => worker.child.pid!).filter(processIsAlive),
      leftovers: readdirSync(root).filter(
        (name) => !name.startsWith('gate-') && !name.startsWith('arrived-')
      ),
    }
  } finally {
    watcher.close()
  }
}

function deadProcessId(): number {
  const { pid } = spawnSync(process.execPath, ['-e', ''])
  if (!pid || processIsAlive(pid)) throw new Error('could not obtain a dead process id')
  return pid
}

test.group('Lock with real concurrent processes', (group) => {
  group.each.teardown(() => {
    // Our own test processes only; normally they have already exited.
    for (const child of spawned.splice(0)) {
      if (child.exitCode === null && child.signalCode === null) child.kill()
    }
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test('simultaneous acquisition: exactly one process gets the lock', async ({ assert }) => {
    const report = await runRound({ workers: 6, pausePoint: 'beforeCreate' })

    assert.equal(report.arrivals, 6, 'every process reached the creation point together')
    assert.lengthOf(report.acquired, 1)
    assert.deepEqual(report.refused, Array(5).fill('TestDatabaseLockedError'))
    assert.equal(report.lockOwnerWhileHeld, report.acquired[0])
    assert.deepEqual(report.exitCodes, Array(6).fill(0))
    assert.deepEqual(report.survivors, [])
    assert.deepEqual(report.leftovers, [], 'no lock, temporary file or .reap left behind')
  }).timeout(30_000)

  test('abandoned lock: one process at a time inside the replacement', async ({ assert }) => {
    const abandonedOwner = deadProcessId()
    const report = await runRound({ workers: 6, pausePoint: 'insideReplace', abandonedOwner })

    assert.equal(report.arrivals, 1, 'only one process entered the critical section')
    assert.lengthOf(report.acquired, 1)
    assert.deepEqual(report.refused, Array(5).fill('TestDatabaseLockedError'))
    assert.equal(report.lockOwnerWhileHeld, report.acquired[0])
    assert.notEqual(report.lockOwnerWhileHeld, abandonedOwner)
    assert.deepEqual(report.exitCodes, Array(6).fill(0))
    assert.deepEqual(report.survivors, [])
    assert.deepEqual(report.leftovers, [], 'no lock, temporary file or .reap left behind')
  }).timeout(30_000)
})
