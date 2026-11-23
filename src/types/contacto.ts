/* Tipos del módulo de contacto (contacto-service, puerto 8088). */

export type EstadoMensaje = 'PENDIENTE' | 'LEIDO' | 'RESPONDIDO' | 'ARCHIVADO'

export const NOMBRE_ESTADO_MENSAJE: Record<EstadoMensaje, string> = {
  PENDIENTE: 'Pendiente',
  LEIDO: 'Leído',
  RESPONDIDO: 'Respondido',
  ARCHIVADO: 'Archivado',
}

/** Lo que escribe el visitante en el formulario de /contacto. */
export interface NuevoMensaje {
  nombre: string
  correo: string
  telefono: string
  asunto: string
  mensaje: string
}

/** Mensaje tal como lo devuelve contacto-service. */
export interface MensajeContacto extends NuevoMensaje {
  id: number
  estado: EstadoMensaje
  respuesta: string | null
  respondidoPor: string | null
  correoUsuario: string | null // cuenta asociada si se envió con la sesión iniciada
  fechaEnvio: string
  fechaRespuesta: string | null
}
