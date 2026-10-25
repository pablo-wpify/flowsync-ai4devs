import { ApiError, type ApiErrorItem } from '@/lib/api'

export type FieldErrors = Partial<Record<string, string>>

export type FormErrors = {
  fields: FieldErrors
  message: string | null
}

const NETWORK_MESSAGE =
  'No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.'
const SERVER_MESSAGE =
  'El servidor tuvo un problema. Intentá de nuevo en unos minutos.'
const UNEXPECTED_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.'
const CONFIG_MESSAGE =
  'La aplicación no está configurada: falta VITE_API_URL en el archivo .env.local del frontend.'

function translateFieldError(item: ApiErrorItem): string {
  const min = item.meta?.min
  const max = item.meta?.max

  switch (item.rule) {
    case 'required':
      return 'Este campo es obligatorio.'
    case 'email':
      return 'Ingresá un email válido.'
    case 'database.unique':
      return 'Ya existe una cuenta con este email.'
    case 'sameAs':
      return 'Las contraseñas no coinciden.'
    case 'minLength':
      return typeof min === 'number'
        ? `Debe tener al menos ${min} caracteres.`
        : item.message
    case 'maxLength':
      return typeof max === 'number'
        ? `No puede superar los ${max} caracteres.`
        : item.message
    default:
      return item.message
  }
}

/** Mensaje general, sin detalle por campo. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return UNEXPECTED_MESSAGE
  }
  if (error.kind === 'network') {
    return NETWORK_MESSAGE
  }
  if (error.kind === 'config') {
    return CONFIG_MESSAGE
  }
  if (error.status !== null && error.status >= 500) {
    return SERVER_MESSAGE
  }
  return UNEXPECTED_MESSAGE
}

/** Traduce un error de signup/login a errores por campo + mensaje general. */
export function toFormErrors(error: unknown): FormErrors {
  if (!(error instanceof ApiError) || error.kind !== 'http') {
    return { fields: {}, message: describeError(error) }
  }

  if (error.status === 400) {
    return { fields: {}, message: 'Email o contraseña incorrectos.' }
  }

  if (error.status === 422) {
    const fields: FieldErrors = {}
    const unassigned: string[] = []
    for (const item of error.errors) {
      if (!item.field) {
        unassigned.push(item.message)
      } else if (!fields[item.field]) {
        fields[item.field] = translateFieldError(item)
      }
    }
    return {
      fields,
      message:
        unassigned.length > 0
          ? unassigned.join(' ')
          : Object.keys(fields).length > 0
            ? null
            : UNEXPECTED_MESSAGE,
    }
  }

  return { fields: {}, message: describeError(error) }
}
