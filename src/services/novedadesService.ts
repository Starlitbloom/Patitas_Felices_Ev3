/* =========================================================
   novedadesService — novedades de la clínica desde novedad-service.

   EP3: las publicaciones ya no están escritas en el código; vienen de
   MySQL a través de novedad-service (GET /novedades es público).
   El administrador puede crear, editar y eliminar novedades.
========================================================= */
import { pedir } from './api'
import { NOVEDADES, type Novedad } from '../data/contenidoNovedades'

/** Categorías que usa el sitio para filtrar. */
export const CATEGORIAS_NOVEDAD = ['Salud', 'Prevención', 'Bienestar', 'Consejos'] as const
export type CategoriaNovedad = (typeof CATEGORIAS_NOVEDAD)[number]

/** Novedad tal como la guarda novedad-service. */
export interface NovedadApi {
  id: number
  titulo: string
  descripcion: string
  imagenUrl: string | null
  categoria: string | null
  fechaPublicacion: string
  activa: boolean
}

/** Datos que se envían al crear o editar. */
export interface DatosNovedad {
  titulo: string
  descripcion: string
  imagenUrl: string
  categoria: CategoriaNovedad
  activa: boolean
}

const IMAGEN_POR_DEFECTO = '/img/consulta.png'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** "2026-09-05T10:00:00" → "05 septiembre 2026" (mismo formato que usaba el sitio). */
export function formatearFechaNovedad(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number)
  if (!anio || !mes || !dia) return ''
  return `${String(dia).padStart(2, '0')} ${MESES[mes - 1]} ${anio}`
}

function categoriaValida(categoria: string | null): CategoriaNovedad {
  return (CATEGORIAS_NOVEDAD as readonly string[]).includes(categoria ?? '')
    ? (categoria as CategoriaNovedad)
    : 'Consejos'
}

/** Convierte la respuesta del backend al formato que usan las tarjetas del sitio. */
export function desdeApi(n: NovedadApi): Novedad {
  return {
    id: String(n.id),
    categoria: categoriaValida(n.categoria),
    fecha: formatearFechaNovedad(n.fechaPublicacion),
    titulo: n.titulo,
    descripcion: n.descripcion,
    imagen: n.imagenUrl || IMAGEN_POR_DEFECTO,
    alt: n.titulo,
  }
}

/**
 * Artículo largo asociado (data/detalleNovedades.ts): las publicaciones originales
 * tienen un texto extendido; se reconoce por el título.
 */
export function claveArticulo(titulo: string): string | null {
  const original = NOVEDADES.find((n) => n.titulo.trim().toLowerCase() === titulo.trim().toLowerCase())
  return original ? original.id : null
}

/** Todas las novedades (sin filtrar), de la más reciente a la más antigua. */
export async function listarNovedadesApi(): Promise<NovedadApi[]> {
  const lista = await pedir<NovedadApi[]>('novedad', '/novedades', { sinToken: true })
  return [...lista].sort((a, b) => b.fechaPublicacion.localeCompare(a.fechaPublicacion))
}

/** Novedades activas para el sitio público. */
export async function listarNovedades(): Promise<Novedad[]> {
  const lista = await listarNovedadesApi()
  return lista.filter((n) => n.activa !== false).map(desdeApi)
}

/** Una novedad por id (null si no existe o no está activa). */
export async function obtenerNovedad(id: string): Promise<Novedad | null> {
  if (!/^\d+$/.test(id)) return null
  try {
    const n = await pedir<NovedadApi>('novedad', `/novedades/${id}`, { sinToken: true })
    return n.activa === false ? null : desdeApi(n)
  } catch {
    return null
  }
}

/* ---------------- Administración (solo ADMIN) ---------------- */

export function crearNovedad(datos: DatosNovedad): Promise<NovedadApi> {
  return pedir<NovedadApi>('novedad', '/novedades', { metodo: 'POST', cuerpo: datos })
}

export function actualizarNovedad(id: number, datos: DatosNovedad): Promise<NovedadApi> {
  return pedir<NovedadApi>('novedad', `/novedades/${id}`, { metodo: 'PUT', cuerpo: datos })
}

export function eliminarNovedad(id: number): Promise<void> {
  return pedir<void>('novedad', `/novedades/${id}`, { metodo: 'DELETE' })
}
