import { createContext, useContext } from 'react'
import type { User } from '@/lib/api'

/**
 * - `anonymous`: no hay token.
 * - `loading`: hay token y se está pidiendo el perfil.
 * - `authenticated`: el perfil se cargó con ese token.
 * - `error`: fallo de red o 5xx al pedir el perfil; el token se conserva.
 */
export type AuthStatus = 'anonymous' | 'loading' | 'authenticated' | 'error'

export type AuthContextValue = {
  status: AuthStatus
  user: User | null
  /** Mensaje del estado `error`. */
  error: string | null
  /** Aviso para la pantalla de login, p. ej. sesión expirada. */
  notice: string | null
  login: (email: string, password: string) => Promise<void>
  retry: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return value
}
