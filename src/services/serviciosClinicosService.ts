/* =========================================================
   serviciosClinicosService — catálogo de servicios de la clínica
   (servicio-clinico-service, puerto 8084).

   En la EP2 el catálogo estaba escrito en src/data/serviciosClinica.ts.
   Ahora lo entrega el backend. GET /servicios es PÚBLICO (no necesita token)
   y ya viene filtrado por especie y ordenado por grupo y nombre.

   Las VACUNAS no son parte de este catálogo: siguen en serviciosClinica.ts
   (CATALOGO_VACUNAS), porque se registran en historial-service.
========================================================= */
import type { Especie } from '../types/mascota'
import type { GrupoServicios } from '../data/serviciosClinica'
import { pedir } from './api'

/** Servicio tal como lo devuelve servicio-clinico-service. */
export interface ServicioClinicoApi {
  id: number
  grupo: string
  nombre: string
  activo: boolean
  /** Vacío = sirve para todas las especies. */
  especies: string[]
}

/** Servicios activos (opcionalmente solo los que sirven para una especie). */
export function listarServiciosClinicos(especie?: Especie): Promise<ServicioClinicoApi[]> {
  const filtro = especie ? `?especie=${encodeURIComponent(especie)}` : ''
  return pedir<ServicioClinicoApi[]>('servicioClinico', `/servicios${filtro}`)
}

/**
 * Catálogo agrupado como lo dibuja SelectorServicios:
 * [{ grupo: 'Cirugía', servicios: [{ nombre: '...' }] }, ...]
 * Respeta el orden en que llegan los grupos desde el backend.
 */
export async function listarGruposServicios(especie: Especie): Promise<GrupoServicios[]> {
  const grupos: GrupoServicios[] = []
  for (const s of await listarServiciosClinicos(especie)) {
    let grupo = grupos.find((g) => g.grupo === s.grupo)
    if (!grupo) {
      grupo = { grupo: s.grupo, servicios: [] }
      grupos.push(grupo)
    }
    grupo.servicios.push({ nombre: s.nombre, especies: s.especies.length ? (s.especies as Especie[]) : undefined })
  }
  return grupos
}
