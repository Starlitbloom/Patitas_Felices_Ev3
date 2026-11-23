/* =========================================================
   notificacionesService — avisos del usuario (campanita)
   desde notificacion-service (puerto 8089).
   Los avisos los crean otros microservicios por WebClient
   (ej: contacto-service al responder un mensaje).
========================================================= */
import type { Notificacion } from '../types/notificacion'
import { pedir } from './api'

export function listarMisNotificaciones(soloNoLeidas = false): Promise<Notificacion[]> {
  return pedir<Notificacion[]>('notificacion', `/notificaciones/mis-notificaciones?soloNoLeidas=${soloNoLeidas}`)
}

export async function contarNoLeidas(): Promise<number> {
  const { cantidad } = await pedir<{ cantidad: number }>('notificacion', '/notificaciones/mis-notificaciones/no-leidas')
  return cantidad
}

export function marcarLeida(id: number): Promise<Notificacion> {
  return pedir<Notificacion>('notificacion', `/notificaciones/${id}/leer`, { metodo: 'PUT' })
}

export async function marcarTodasLeidas(): Promise<number> {
  const { marcadas } = await pedir<{ marcadas: number }>('notificacion', '/notificaciones/mis-notificaciones/leer-todas', { metodo: 'PUT' })
  return marcadas
}

export function eliminarNotificacion(id: number): Promise<void> {
  return pedir<void>('notificacion', `/notificaciones/${id}`, { metodo: 'DELETE' })
}
