import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { AuthLayout } from '@/components/auth-layout'
import { FormField } from '@/components/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toFormErrors, type FormErrors } from '@/lib/errors'

/** Estado de navegación que deja el registro al redirigir aquí. */
export type LoginLocationState = { registeredEmail?: string } | null

export function LoginPage() {
  const { login, notice } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Se lee una sola vez y se borra del historial para que una recarga no
  // vuelva a mostrar "Cuenta creada".
  const [registeredEmail] = useState(
    () => (location.state as LoginLocationState)?.registeredEmail,
  )
  useEffect(() => {
    if (location.state) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, navigate])

  const [email, setEmail] = useState(registeredEmail ?? '')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({
    fields: {},
    message: null,
  })
  const [submitting, setSubmitting] = useState(false)
  // Los avisos de llegada (registro, sesión expirada) se ocultan al primer envío.
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitted(true)
    setErrors({ fields: {}, message: null })
    try {
      await login(email, password)
      navigate('/profile', { replace: true })
    } catch (error) {
      setErrors(toFormErrors(error))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>Entrá con tu email y contraseña.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="flex flex-col gap-4">
            {registeredEmail && !submitted && (
              <Alert>
                <AlertDescription>
                  Cuenta creada. Ya podés iniciar sesión.
                </AlertDescription>
              </Alert>
            )}
            {notice && !registeredEmail && !submitted && (
              <Alert>
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}
            {errors.message && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{errors.message}</AlertDescription>
              </Alert>
            )}
            <FormField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.fields.email}
            />
            <FormField
              id="password"
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.fields.password}
            />
          </CardContent>
          <CardFooter className="mt-6 flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Ingresando…' : 'Iniciar sesión'}
            </Button>
            <p className="text-sm text-muted-foreground">
              ¿No tenés cuenta?{' '}
              <Link to="/signup" className="text-foreground underline">
                Registrate
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  )
}
