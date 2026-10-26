import { useAuth } from '@/auth/auth-context'
import { AuthLayout } from '@/components/auth-layout'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const dateFormat = new Intl.DateTimeFormat('es', { dateStyle: 'long' })

export function ProfilePage() {
  const { user } = useAuth()

  // ProtectedRoute solo renderiza esta página con el perfil cargado.
  if (!user) {
    return null
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-medium text-primary-foreground"
          >
            {user.initials}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="truncate">
              {user.fullName ?? user.email}
            </CardTitle>
            <CardDescription>Tu perfil</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Miembro desde</dt>
              <dd>{dateFormat.format(new Date(user.createdAt))}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
