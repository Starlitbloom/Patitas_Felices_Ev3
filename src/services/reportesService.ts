/* =========================================================
   reportesService — datos del Dashboard y de Reportes desde
   report-service (puerto 8090).
   report-service a su vez consulta por WebClient a auth, mascotas,
   citas, contacto y notificaciones. Si alguno está apagado, esa
   sección llega en null y su nombre aparece en serviciosNoDisponibles.
========================================================= */
import { pedir } from './api'

export interface Conteo {
  nombre: string
  cantidad: number
}

export interface UsuarioReciente {
  id: number
  nombre: string
  correo: string
  comuna: string
  rol: string // "ADMIN" | "RECEPCIONISTA" | "CLIENTE"
  fechaRegistro: string
}

export interface Dashboard {
  usuarios?: { total: number; nuevosEstaSemana: number; ultimosRegistrados: UsuarioReciente[] } | null
  clinica: {
    mascotasRegistradas: number | null
    citasPendientes: number | null
    solicitudesPendientes: number | null
  }
  serviciosNoDisponibles: string[]
}

export interface ReporteCompleto {
  usuarios: {
    total: number
    administradores: number
    recepcionistas: number
    clientes: number
    regionesConUsuarios: number
    conFotoPerfil: number
    nuevosEstaSemana: number
    porRegion: Conteo[]
    topComunas: { comuna: string; region: string; cantidad: number }[]
  } | null
  mascotas: {
    total: number
    conDatosIncompletos: number
    solicitudesPendientes: number | null
    porEstado: { alDia: number; tratamiento: number; pendiente: number }
    porEspecie: Conteo[]
  } | null
  citas: { total: number; pendientes: number; confirmadas: number; canceladas: number; porServicio: Conteo[] } | null
  contacto: Record<string, number> | null
  notificaciones: Record<string, number> | null
  serviciosNoDisponibles: string[]
  generadoPor: string
  generadoEn: string
}

export interface Exportacion {
  nombreArchivo: string
  hojas: Record<string, Record<string, unknown>[]>
  serviciosNoDisponibles: string[]
}

export function obtenerDashboard(): Promise<Dashboard> {
  return pedir<Dashboard>('reporte', '/reportes/dashboard')
}

export function obtenerReporteCompleto(): Promise<ReporteCompleto> {
  return pedir<ReporteCompleto>('reporte', '/reportes/completo')
}

export function obtenerExportacion(): Promise<Exportacion> {
  return pedir<Exportacion>('reporte', '/reportes/exportar')
}
