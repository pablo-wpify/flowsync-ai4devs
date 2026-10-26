const TOKEN_KEY = 'flowsync.token'

// sessionStorage puede lanzar (modo privado, almacenamiento bloqueado): en ese
// caso la sesión vive solo en memoria y se pierde al recargar.

export function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function writeToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    // ignorado: ver comentario arriba
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignorado: ver comentario arriba
  }
}
