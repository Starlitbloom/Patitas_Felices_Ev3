/* Tipos de las notificaciones (notificacion-service, puerto 8089). */

export type TipoNotificacion = 'CITA' | 'MASCOTA' | 'SOLICITUD' | 'CONTACTO' | 'SISTEMA'

export const ICONO_NOTIFICACION: Record<TipoNotificacion, string> = {
  CITA: '📅',
  MASCOTA: '🐾',
  SOLICITUD: '📝',
  CONTACTO: '✉️',
  SISTEMA: '🔔',
}

export interface Notificacion {
  id: number
  correoDestinatario: string
  titulo: string
  mensaje: string
  tipo: TipoNotificacion
  enlace: string | null // ruta del frontend a la que lleva el aviso
  leida: boolean
  creadaPor: string | null
  fechaCreacion: string
  fechaLectura: string | null
}
