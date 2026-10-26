/**
 * Route surface contract.
 *
 * Compares the routes the application registers, as reported by
 * `node ace list:routes --json`, with the reviewed reference in
 * contracts/route_surface.v1.json. Only the route surface is covered: methods,
 * patterns, named middleware and handlers. Validators, responses and status
 * codes are not.
 *
 * Usage, from backend/ with Node >= 24:
 *
 *   node scripts/check_route_surface.ts           compare; never writes the reference
 *   node scripts/check_route_surface.ts --update  regenerate the reference on purpose
 *
 * Exit codes: 0 the surface matches, 1 differences, 2 the candidate or the
 * reference could not be generated, read or parsed. They hold once this
 * script runs: if Node cannot load it (Node < 24 cannot strip types), Node
 * itself exits with 1.
 */
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const referencePath = join(backendDir, 'contracts', 'route_surface.v1.json')

const CONTRACT = 'route-surface'
const VERSION = 1
const SOURCE = 'node ace list:routes --json'
/**
 * list:routes hides HEAD and has no flag to show it; AdonisJS adds HEAD to
 * every GET route. A HEAD in the source is therefore unexpected and fails.
 */
const EXCLUDED = {
  HEAD: 'Not listed by list:routes, which has no flag to show it. AdonisJS adds HEAD to every GET route.',
}
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
const TIMEOUT_MS = 120_000
const UNREPRESENTABLE =
  'the contract cannot represent it; extending it requires changing this script'

type Handler =
  | { type: 'closure'; name: string }
  | { type: 'controller'; moduleNameOrPath: string; method: string }
type Middleware = { name: string; moduleNameOrPath: string; method: string }
type Route = {
  public: { methods: string[]; pattern: string; middleware: string[] }
  internal: { name: string; handler: Handler; middleware: Middleware[] }
}
type Domain = { domain: string; routes: Route[] }
type Contract = {
  contract: string
  version: number
  source: string
  excluded: typeof EXCLUDED
  domains: Domain[]
}

/**
 * The candidate could not be generated, or the candidate or the reference does
 * not have the expected shape. Messages name locations and key names, never
 * values.
 */
class CheckError extends Error {}

function expectObject(value: unknown, keys: string[], where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CheckError(`${where}: expected an object`)
  }
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new CheckError(`${where}: expected keys [${expected}], got [${actual}]`)
  }
  return value as Record<string, unknown>
}

function expectArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new CheckError(`${where}: expected an array`)
  return value
}

function expectString(value: unknown, where: string): string {
  if (typeof value !== 'string') throw new CheckError(`${where}: expected a string`)
  return value
}

function expectMethods(value: unknown, where: string): string[] {
  const methods = expectArray(value, where).map((method, index) =>
    expectString(method, `${where}[${index}]`)
  )
  if (methods.length === 0) throw new CheckError(`${where}: no methods; ${UNREPRESENTABLE}`)
  for (const method of methods) {
    if (!METHODS.has(method)) {
      throw new CheckError(`${where}: unexpected method; ${UNREPRESENTABLE}`)
    }
  }
  return methods
}

function expectPattern(value: unknown, where: string): string {
  const pattern = expectString(value, where)
  if (!pattern.startsWith('/')) throw new CheckError(`${where}: expected a leading "/"`)
  return pattern
}

function parseHandler(value: unknown, where: string): Handler {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CheckError(`${where}: expected an object`)
  }
  const { type } = value as { type?: unknown }
  if (type === 'closure') {
    const handler = expectObject(value, ['type', 'name'], where)
    return { type, name: expectString(handler.name, `${where}.name`) }
  }
  if (type === 'controller') {
    const handler = expectObject(value, ['type', 'moduleNameOrPath', 'method'], where)
    return {
      type,
      moduleNameOrPath: expectString(handler.moduleNameOrPath, `${where}.moduleNameOrPath`),
      method: expectString(handler.method, `${where}.method`),
    }
  }
  throw new CheckError(`${where}.type: unexpected handler type`)
}

/**
 * list:routes adds `type`; only named middleware can be represented. The
 * reference stores the entry without it.
 */
function parseMiddleware(value: unknown, where: string, fromSource: boolean): Middleware {
  if (fromSource && (value as { type?: unknown } | null)?.type !== 'named') {
    throw new CheckError(`${where}.type: not a named middleware; ${UNREPRESENTABLE}`)
  }
  const keys = ['name', 'moduleNameOrPath', 'method']
  const middleware = expectObject(value, fromSource ? ['type', ...keys] : keys, where)
  return {
    name: expectString(middleware.name, `${where}.name`),
    moduleNameOrPath: expectString(middleware.moduleNameOrPath, `${where}.moduleNameOrPath`),
    method: expectString(middleware.method, `${where}.method`),
  }
}

/**
 * Converts the output of list:routes into contract domains, keeping the order
 * of domains, routes and middleware.
 */
function parseSource(raw: unknown): Domain[] {
  return expectArray(raw, 'source').map((value, d) => {
    const where = `source[${d}]`
    const domain = expectObject(value, ['domain', 'routes'], where)
    return {
      domain: expectString(domain.domain, `${where}.domain`),
      routes: expectArray(domain.routes, `${where}.routes`).map((routeValue, r) => {
        const at = `${where}.routes[${r}]`
        const route = expectObject(
          routeValue,
          ['name', 'pattern', 'methods', 'handler', 'middleware'],
          at
        )
        const middleware = expectArray(route.middleware, `${at}.middleware`).map((item, m) =>
          parseMiddleware(item, `${at}.middleware[${m}]`, true)
        )
        return {
          public: {
            methods: expectMethods(route.methods, `${at}.methods`),
            pattern: expectPattern(route.pattern, `${at}.pattern`),
            middleware: middleware.map(({ name }) => name),
          },
          internal: {
            name: expectString(route.name, `${at}.name`),
            handler: parseHandler(route.handler, `${at}.handler`),
            middleware,
          },
        }
      }),
    }
  })
}

/**
 * Validates the reference file with the same strictness as the source.
 */
function parseReference(raw: unknown): Contract {
  const contract = expectObject(
    raw,
    ['contract', 'version', 'source', 'excluded', 'domains'],
    'reference'
  )
  if (
    contract.contract !== CONTRACT ||
    contract.version !== VERSION ||
    contract.source !== SOURCE ||
    JSON.stringify(contract.excluded) !== JSON.stringify(EXCLUDED)
  ) {
    throw new CheckError('reference: unexpected contract, version, source or excluded')
  }
  const domains = expectArray(contract.domains, 'reference.domains').map((value, d) => {
    const where = `reference.domains[${d}]`
    const domain = expectObject(value, ['domain', 'routes'], where)
    return {
      domain: expectString(domain.domain, `${where}.domain`),
      routes: expectArray(domain.routes, `${where}.routes`).map((routeValue, r) => {
        const at = `${where}.routes[${r}]`
        const route = expectObject(routeValue, ['public', 'internal'], at)
        const pub = expectObject(route.public, ['methods', 'pattern', 'middleware'], `${at}.public`)
        const internal = expectObject(
          route.internal,
          ['name', 'handler', 'middleware'],
          `${at}.internal`
        )
        const publicMiddleware = expectArray(pub.middleware, `${at}.public.middleware`).map(
          (name, m) => expectString(name, `${at}.public.middleware[${m}]`)
        )
        const internalMiddleware = expectArray(
          internal.middleware,
          `${at}.internal.middleware`
        ).map((item, m) => parseMiddleware(item, `${at}.internal.middleware[${m}]`, false))
        if (
          JSON.stringify(publicMiddleware) !==
          JSON.stringify(internalMiddleware.map(({ name }) => name))
        ) {
          throw new CheckError(`${at}: public and internal middleware names differ`)
        }
        return {
          public: {
            methods: expectMethods(pub.methods, `${at}.public.methods`),
            pattern: expectPattern(pub.pattern, `${at}.public.pattern`),
            middleware: publicMiddleware,
          },
          internal: {
            name: expectString(internal.name, `${at}.internal.name`),
            handler: parseHandler(internal.handler, `${at}.internal.handler`),
            middleware: internalMiddleware,
          },
        }
      }),
    }
  })
  return { contract: CONTRACT, version: VERSION, source: SOURCE, excluded: EXCLUDED, domains }
}

/**
 * Exception class name at the start of the first non-empty line of an output,
 * such as `EnvValidationException:`, after removing ANSI color codes. Nothing
 * else is taken from it.
 */
function exceptionName(output: string): string | undefined {
  const plain = output.replace(new RegExp(String.raw`\u001b\[[0-9;]*m`, 'g'), '')
  const first = plain.split('\n').find((line) => line.trim() !== '') ?? ''
  return /^[^A-Za-z0-9]*([A-Z][A-Za-z]*(?:Error|Exception)):/.exec(first)?.[1]
}

/**
 * Runs list:routes. On failure only how it ended and, if present, an
 * exception class name are reported: the raw output may contain absolute
 * paths or environment values.
 */
function generate(): Promise<Contract> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ['ace', 'list:routes', '--json'],
      { cwd: backendDir, maxBuffer: 10 * 1024 * 1024, timeout: TIMEOUT_MS },
      (error, stdout, stderr) => {
        if (error) {
          const ending = error.killed
            ? `did not finish within ${TIMEOUT_MS / 1000} s`
            : error.signal
              ? `ended by signal ${error.signal}`
              : `failed (exit code ${error.code ?? 'unknown'})`
          const exception = exceptionName(stdout) ?? exceptionName(stderr)
          return reject(
            new CheckError(
              `"${SOURCE}" ${ending}${exception ? `, ${exception}` : ''}; its output is not shown. Run it by hand to see it.`
            )
          )
        }
        let raw: unknown
        try {
          raw = JSON.parse(stdout)
        } catch {
          return reject(
            new CheckError(
              `"${SOURCE}" did not print valid JSON (${stdout.length} bytes, not shown)`
            )
          )
        }
        try {
          resolve({
            contract: CONTRACT,
            version: VERSION,
            source: SOURCE,
            excluded: EXCLUDED,
            domains: parseSource(raw),
          })
        } catch (parseError) {
          reject(parseError)
        }
      }
    )
  })
}

function serialize(contract: Contract): string {
  return `${JSON.stringify(contract, null, 2)}\n`
}

/**
 * One line per route and section, so a diff shows which part changed.
 */
function lines(contract: Contract, section: 'public' | 'internal'): string[] {
  return contract.domains.flatMap(({ domain, routes }) =>
    routes.map((route) => {
      const at = `${domain} ${route.public.methods.join(',')} ${route.public.pattern}`
      if (section === 'public') return `${at} middleware=[${route.public.middleware.join(', ')}]`
      const { name, handler, middleware } = route.internal
      const target =
        handler.type === 'closure'
          ? `closure:${handler.name}`
          : `${handler.moduleNameOrPath}.${handler.method}`
      const chain = middleware.map((m) => `${m.name}:${m.moduleNameOrPath}.${m.method}`)
      return `${at} name=${name || '(anonymous)'} handler=${target} middleware=[${chain.join(', ')}]`
    })
  )
}

/**
 * Line diff based on the longest common subsequence, keeping order. On a tie
 * the reference line is printed first.
 */
function diff(before: string[], after: string[]): string[] {
  const lcs = before.map(() => Array<number>(after.length + 1).fill(0))
  lcs.push(Array<number>(after.length + 1).fill(0))
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lcs[i][j] =
        before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const out: string[] = []
  let i = 0
  let j = 0
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      i++
      j++
    } else if (j < after.length && (i === before.length || lcs[i][j + 1] > lcs[i + 1][j])) {
      out.push(`+ ${after[j++]}`)
    } else {
      out.push(`- ${before[i++]}`)
    }
  }
  return out
}

async function readReference(): Promise<Contract> {
  let text: string
  try {
    text = await readFile(referencePath, 'utf8')
  } catch {
    throw new CheckError(
      'reference contracts/route_surface.v1.json cannot be read; create it on purpose with --update'
    )
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new CheckError('reference contracts/route_surface.v1.json is not valid JSON')
  }
  const reference = parseReference(raw)
  // Rejects what JSON.parse would hide: duplicate keys, other key order or formatting.
  if (serialize(reference) !== text) {
    throw new CheckError(
      'reference contracts/route_surface.v1.json is not in the form --update writes; regenerate it with --update'
    )
  }
  return reference
}

/**
 * Keeps the candidate for inspection when there are differences. Best effort:
 * if it cannot be written, the differences are still reported with exit 1.
 */
async function keepCandidate(candidate: Contract): Promise<void> {
  try {
    const directory = await mkdtemp(join(tmpdir(), 'route-surface-'))
    const candidatePath = join(directory, 'route_surface.candidate.json')
    await writeFile(candidatePath, serialize(candidate))
    console.log(`\nCandidate kept for inspection: ${candidatePath}`)
    console.log(`Remove it when done: rm -r ${directory}`)
  } catch {
    console.log('\nThe candidate could not be written to the temporary directory.')
  }
}

async function check(): Promise<number> {
  const reference = await readReference()
  const candidate = await generate()
  if (serialize(reference) === serialize(candidate)) {
    console.log('Route surface matches contracts/route_surface.v1.json')
    return 0
  }
  console.log('Route surface differs from contracts/route_surface.v1.json (- reference, + current)')
  for (const section of ['public', 'internal'] as const) {
    const changes = diff(lines(reference, section), lines(candidate, section))
    console.log(`\n[${section}]${changes.length ? '' : ' no line changes'}`)
    for (const change of changes) console.log(change)
  }
  await keepCandidate(candidate)
  console.log('If the change is intended, update the reference with --update and review the diff.')
  return 1
}

/**
 * Writes the reference only after the candidate was generated and validated,
 * through a temporary file in the same directory and a rename.
 */
async function update(): Promise<number> {
  const candidate = await generate()
  const temporary = `${referencePath}.${process.pid}.tmp`
  try {
    await writeFile(temporary, serialize(candidate), { flag: 'wx' })
    await rename(temporary, referencePath)
  } finally {
    await rm(temporary, { force: true })
  }
  console.log('Wrote contracts/route_surface.v1.json. Review it with git diff before committing.')
  return 0
}

const args = process.argv.slice(2)
if (args.length > 1 || (args.length === 1 && args[0] !== '--update')) {
  console.error('Usage: node scripts/check_route_surface.ts [--update]')
  process.exitCode = 2
} else {
  try {
    process.exitCode = args[0] === '--update' ? await update() : await check()
  } catch (error) {
    if (error instanceof CheckError) {
      console.error(`Route surface check failed: ${error.message}`)
    } else {
      console.error('Route surface check failed with an unexpected error; details not shown.')
    }
    process.exitCode = 2
  }
}
