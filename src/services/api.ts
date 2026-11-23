/* =========================================================
   api — cliente HTTP para hablar con los microservicios.
   Reemplaza a localStorage como fuente de datos (EP3).

   Qué hace en CADA petición:
   1. Arma la URL del microservicio (auth, contacto, reportes...).
   2. Agrega el header "Authorization: Bearer <token>" si hay sesión.
   3. Si el backend responde 401 (token vencido), pide un token nuevo
      a auth-service con el refreshToken y REINTENTA la petición una vez.
      Si tampoco se puede renovar, cierra la sesión (evento
      "patitas:sesion-expirada" que escucha AuthContext).
   4. Si hay error, lanza ApiError con el mismo formato del backend:
      { status, campo, mensaje } → el formulario marca el input con error.
========================================================= */

/** URL base de cada microservicio. Se pueden cambiar en el archivo .env (ver .env.example). */
export const SERVICIOS = {
  auth: import.meta.env.VITE_AUTH_URL ?? 'http://localhost:8081/api/v1',
  mascota: import.meta.env.VITE_MASCOTA_URL ?? 'http://localhost:8082/api/v1',
  cita: import.meta.env.VITE_CITA_URL ?? 'http://localhost:8086/api/v1',
  contacto: import.meta.env.VITE_CONTACTO_URL ?? 'http://localhost:8088/api/v1',
  notificacion: import.meta.env.VITE_NOTIFICACION_URL ?? 'http://localhost:8089/api/v1',
  reporte: import.meta.env.VITE_REPORTE_URL ?? 'http://localhost:8090/api/v1',
} as const

export type Servicio = keyof typeof SERVICIOS

/** Nombre del microservicio para los mensajes de error. */
const NOMBRE_SERVICIO: Record<Servicio, string> = {
  auth: 'auth-service (puerto 8081)',
  mascota: 'mascota-service (puerto 8082)',
  cita: 'cita-service (puerto 8086)',
  contacto: 'contacto-service (puerto 8088)',
  notificacion: 'notificacion-service (puerto 8089)',
  reporte: 'report-service (puerto 8090)',
}

/** Claves de localStorage donde se guardan los tokens JWT. */
export const CLAVES_TOKEN = {
  token: 'patitasFelices_token',
  refresh: 'patitasFelices_refreshToken',
} as const

/** Evento que se dispara cuando la sesión venció y no se pudo renovar. */
export const EVENTO_SESION_EXPIRADA = 'patitas:sesion-expirada'

/** Error de la API con el mismo formato que responden los microservicios. */
export class ApiError extends Error {
  status: number
  campo: string | null

  constructor(status: number, campo: string | null, mensaje: string) {
    super(mensaje)
    this.name = 'ApiError'
    this.status = status
    this.campo = campo
  }
}

/* ---------------- Tokens ---------------- */

export function obtenerToken(): string | null {
  return localStorage.getItem(CLAVES_TOKEN.token)
}

export function obtenerRefreshToken(): string | null {
  return localStorage.getItem(CLAVES_TOKEN.refresh)
}

export function guardarTokens(token: string, refreshToken: string): void {
  localStorage.setItem(CLAVES_TOKEN.token, token)
  localStorage.setItem(CLAVES_TOKEN.refresh, refreshToken)
}

export function borrarTokens(): void {
  localStorage.removeItem(CLAVES_TOKEN.token)
  localStorage.removeItem(CLAVES_TOKEN.refresh)
}

/* ---------------- Renovación del token ---------------- */

// Si varias peticiones vencen al mismo tiempo, todas esperan la MISMA renovación
let renovacionEnCurso: Promise<boolean> | null = null

/** Pide un token nuevo a auth-service usando el refreshToken. Devuelve true si lo logró. */
export function renovarToken(): Promise<boolean> {
  if (!renovacionEnCurso) {
    renovacionEnCurso = (async () => {
      const refreshToken = obtenerRefreshToken()
      if (!refreshToken) return false
      try {
        const respuesta = await fetch(`${SERVICIOS.auth}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        if (!respuesta.ok) return false
        const datos = (await respuesta.json()) as { token: string; refreshToken: string }
        guardarTokens(datos.token, datos.refreshToken)
        return true
      } catch {
        return false
      }
    })().finally(() => {
      renovacionEnCurso = null
    })
  }
  return renovacionEnCurso
}

/* ---------------- Petición genérica ---------------- */

export interface OpcionesPeticion {
  metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  cuerpo?: unknown
  /** true = no enviar el token (login, registro). */
  sinToken?: boolean
}

/**
 * Hace una petición a un microservicio y devuelve el JSON de la respuesta.
 * Lanza ApiError si el servidor responde con error o no está disponible.
 */
export async function pedir<T>(servicio: Servicio, ruta: string, opciones: OpcionesPeticion = {}, reintento = false): Promise<T> {
  const { metodo = 'GET', cuerpo, sinToken = false } = opciones
  const token = sinToken ? null : obtenerToken()

  const headers: Record<string, string> = {}
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let respuesta: Response
  try {
    respuesta = await fetch(`${SERVICIOS[servicio]}${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    })
  } catch {
    throw new ApiError(0, null, `No se pudo conectar con ${NOMBRE_SERVICIO[servicio]}. Revisa que el microservicio esté encendido.`)
  }

  // Token vencido: se renueva una vez y se reintenta la misma petición
  if (respuesta.status === 401 && token && !reintento) {
    if (await renovarToken()) return pedir<T>(servicio, ruta, opciones, true)
    borrarTokens()
    window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA))
  }

  if (!respuesta.ok) {
    let campo: string | null = null
    let mensaje = `Error ${respuesta.status} al comunicarse con ${NOMBRE_SERVICIO[servicio]}.`
    try {
      const error = (await respuesta.json()) as { campo?: string | null; mensaje?: string }
      campo = error.campo ?? null
      if (error.mensaje) mensaje = error.mensaje
    } catch {
      // La respuesta de error no traía JSON: se usa el mensaje genérico
    }
    throw new ApiError(respuesta.status, campo, mensaje)
  }

  if (respuesta.status === 204) return undefined as T
  return (await respuesta.json()) as T
}

/** Convierte cualquier error en un texto para mostrar en pantalla. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Ocurrió un error inesperado. Intenta nuevamente.'
}
