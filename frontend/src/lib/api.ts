const API_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, '')

export type User = {
  id: number
  fullName: string | null
  email: string
  createdAt: string
  updatedAt: string | null
  initials: string
}

type AuthPayload = {
  user: User
  token: string
}

/** Un error tal como lo devuelve el backend en `{ errors: [...] }`. */
export type ApiErrorItem = {
  message: string
  rule?: string
  field?: string
  meta?: Record<string, unknown>
}

/**
 * - `network`: no hubo respuesta (backend caído, CORS, sin conexión).
 * - `http`: el backend respondió con un status de error.
 * - `config`: falta VITE_API_URL.
 */
export class ApiError extends Error {
  readonly kind: 'network' | 'http' | 'config'
  readonly status: number | null
  readonly errors: ApiErrorItem[]

  constructor(
    kind: ApiError['kind'],
    status: number | null,
    errors: ApiErrorItem[] = [],
  ) {
    super(
      errors[0]?.message ?? `API error (${kind}${status ? ` ${status}` : ''})`,
    )
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.errors = errors
  }
}

async function request<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; token?: string } = {},
): Promise<T> {
  if (!API_URL) {
    throw new ApiError('config', null)
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError('network', null)
  }

  const json: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const errors =
      json &&
      typeof json === 'object' &&
      'errors' in json &&
      Array.isArray(json.errors)
        ? (json.errors as ApiErrorItem[])
        : []
    throw new ApiError('http', response.status, errors)
  }

  if (!json || typeof json !== 'object' || !('data' in json)) {
    throw new ApiError('http', response.status)
  }
  return json.data as T
}

export function signup(
  email: string,
  password: string,
  passwordConfirmation: string,
) {
  return request<AuthPayload>('/api/v1/auth/signup', {
    method: 'POST',
    body: { fullName: null, email, password, passwordConfirmation },
  })
}

export function login(email: string, password: string) {
  return request<AuthPayload>('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

export function getProfile(token: string) {
  return request<User>('/api/v1/account/profile', { token })
}
