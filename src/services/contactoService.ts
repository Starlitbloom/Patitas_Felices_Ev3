/* =========================================================
   contactoService — mensajes del formulario de contacto
   (contacto-service, puerto 8088).
   - enviarMensaje: público. Si hay sesión se envía el token y el
     mensaje queda asociado a la cuenta (aparece en "Mis mensajes").
   - Bandeja, estados y respuestas: solo personal (ADMIN / RECEPCIONISTA).
   - Al responder, contacto-service avisa al usuario por WebClient a
     notificacion-service (le aparece en la campanita).
========================================================= */
import type { EstadoMensaje, MensajeContacto, NuevoMensaje } from '../types/contacto'
import { pedir } from './api'

export function enviarMensaje(datos: NuevoMensaje): Promise<MensajeContacto> {
  return pedir<MensajeContacto>('contacto', '/mensajes', { metodo: 'POST', cuerpo: datos })
}

export function listarMensajes(estado?: EstadoMensaje): Promise<MensajeContacto[]> {
  return pedir<MensajeContacto[]>('contacto', estado ? `/mensajes?estado=${estado}` : '/mensajes')
}

export function listarMisMensajes(): Promise<MensajeContacto[]> {
  return pedir<MensajeContacto[]>('contacto', '/mensajes/mis-mensajes')
}

export function cambiarEstadoMensaje(id: number, estado: Exclude<EstadoMensaje, 'RESPONDIDO'>): Promise<MensajeContacto> {
  return pedir<MensajeContacto>('contacto', `/mensajes/${id}/estado`, { metodo: 'PUT', cuerpo: { estado } })
}

export function responderMensaje(id: number, respuesta: string): Promise<MensajeContacto> {
  return pedir<MensajeContacto>('contacto', `/mensajes/${id}/responder`, { metodo: 'PUT', cuerpo: { respuesta } })
}

export function eliminarMensaje(id: number): Promise<void> {
  return pedir<void>('contacto', `/mensajes/${id}`, { metodo: 'DELETE' })
}
