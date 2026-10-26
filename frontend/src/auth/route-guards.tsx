import { Link, Navigate, Outlet } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { AuthLayout } from '@/components/auth-layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/** Rutas que requieren sesión: sin token redirige al login. */
export function ProtectedRoute() {
  const { status, error, retry } = useAuth()

  if (status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  if (status === 'loading') {
    return (
      <AuthLayout>
        <p role="status" className="text-center text-sm text-muted-foreground">
          Cargando tu sesión…
        </p>
      </AuthLayout>
    )
  }

  if (status === 'error') {
    return (
      <AuthLayout>
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Alert variant="destructive">
              <AlertTitle>No pudimos cargar tu perfil</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={retry}>Reintentar</Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="text-foreground underline">
                Iniciar sesión con otra cuenta
              </Link>
            </p>
          </CardContent>
        </Card>
      </AuthLayout>
    )
  }

  return <Outlet />
}

/**
 * Login y registro: con sesión iniciada (o validándose) redirige al perfil.
 * En `error` se dejan accesibles para que el usuario pueda entrar con otra
 * cuenta sin perder el token actual, que un fallo de red no invalida.
 */
export function PublicOnlyRoute() {
  const { status } = useAuth()

  if (status === 'authenticated' || status === 'loading') {
    return <Navigate to="/profile" replace />
  }

  return <Outlet />
}
