import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from '@/auth/auth-context'
import { ApiError, getProfile, login as apiLogin, type User } from '@/lib/api'
import { describeError } from '@/lib/errors'
import { clearToken, readToken, writeToken } from '@/lib/session'

const EXPIRED_NOTICE =
  'Tu sesión no es válida o expiró. Iniciá sesión de nuevo.'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readToken)
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Se incrementa en retry() para volver a pedir el perfil con el mismo token.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!token) {
      return
    }
    let cancelled = false

    getProfile(token).then(
      (profile) => {
        if (!cancelled) {
          setUser(profile)
        }
      },
      (err: unknown) => {
        if (cancelled) {
          return
        }
        if (err instanceof ApiError && err.status === 401) {
          // Token rechazado: limpiar la sesión local y volver al login.
          clearToken()
          setToken(null)
          setUser(null)
          setNotice(EXPIRED_NOTICE)
        } else {
          // Red o 5xx: el token puede seguir siendo válido, se conserva.
          setError(describeError(err))
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [token, attempt])

  const login = useCallback(async (email: string, password: string) => {
    const { token: newToken } = await apiLogin(email, password)
    writeToken(newToken)
    setUser(null)
    setError(null)
    setNotice(null)
    setToken(newToken)
  }, [])

  const retry = useCallback(() => {
    setError(null)
    setAttempt((n) => n + 1)
  }, [])

  const status: AuthStatus = !token
    ? 'anonymous'
    : user
      ? 'authenticated'
      : error
        ? 'error'
        : 'loading'

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, error, notice, login, retry }),
    [status, user, error, notice, login, retry],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
