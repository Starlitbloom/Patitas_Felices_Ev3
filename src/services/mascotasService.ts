/* =========================================================
   mascotasService — mascotas, historial clínico, vacunas y
   solicitudes de cambio (EP3).

   Antes (EP2) todo se guardaba en localStorage. Ahora los datos
   viven en dos microservicios:
   - mascota-service   (puerto 8082): /mascotas y /solicitudes
   - historial-service (puerto 8083): /historial/... (atenciones y vacunas)

   Este archivo "traduce" entre el formato del backend y el que
   ya usaban las páginas, para que los componentes casi no cambien:
   - id numérico (1)            ↔ id de texto ("1")
   - nombreDueno / correoDueno  ↔ dueño / correoDueño
   - fecha ISO "2026-01-10"     ↔ fecha de texto "10 enero 2026"
   - sexo vacío ''              ↔ null (el backend solo acepta Macho/Hembra)

   Lo único que sigue en localStorage son los FAVORITOS: es una
   preferencia de cada navegador, no un dato de la clínica.
========================================================= */
import type {
  CambiosMascota,
  CambiosSolicitud,
  Especie,
  EstadoMascota,
  EstadoSolicitud,
  EstadoVacuna,
  FiltrosMascotas,
  Mascota,
  NuevaMascota,
  RegistroClinico,
  RegistroVacuna,
  Sexo,
  SolicitudCambio,
} from '../types/mascota'
import type { ResultadoOperacion } from '../types/usuario'
import { ApiError, mensajeDeError, pedir } from './api'
import { CLAVES, guardarObjeto, leerObjeto } from './almacenamiento'
import { validarRequerido } from '../utils/validaciones'
import { fechaTextoAIso, formatearFechaInput } from '../utils/fechas'

/* =========================================================
   FORMATO DEL BACKEND (lo que responden los microservicios)
========================================================= */

/** Mascota tal como la devuelve mascota-service. */
export interface MascotaApi {
  id: number
  nombre: string
  especie: string
  raza: string | null
  edad: string | null
  sexo: string | null
  peso: string | null
  nombreDueno: string
  correoDueno: string
  completo: boolean
  imagen: string | null
  estado: string | null
  descripcion: string | null
}

/** Solicitud de cambio tal como la devuelve mascota-service. */
export interface SolicitudApi {
  id: number
  mascotaId: number
  correoSolicitante: string
  raza: string | null
  sexo: string | null
  peso: string | null
  imagen: string | null
  descripcion: string | null
  estado: string
  fechaSolicitud: string
  fechaResolucion: string | null
}

/** Atención clínica tal como la devuelve historial-service. */
export interface AtencionApi {
  id: number
  mascotaId: number
  fecha: string // "2026-08-12"
  motivo: string
  diagnostico: string
  tratamiento: string
  veterinario: string
  servicios: string[]
}

/** Vacuna tal como la devuelve historial-service (el estado lo calcula el backend). */
export interface VacunaApi {
  id: number
  mascotaId: number
  vacuna: string
  fecha: string
  proximoRefuerzo: string
  estado: string
}

/* =========================================================
   CONVERSIONES backend ↔ frontend
========================================================= */

/** Texto vacío → null (el backend valida sexo con "Macho|Hembra" y no acepta ''). */
const vacioANull = (valor: string | undefined | null) => (valor && valor.trim() ? valor.trim() : null)

/** "10 enero 2026" → "2026-01-10". Si ya viene en formato ISO, se deja igual. */
const aIso = (fecha: string) => (/^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : fechaTextoAIso(fecha))

/** "2026-01-10" → "10 enero 2026" (el formato que ya mostraban las tarjetas). */
const aTexto = (fecha: string) => (/^\d{4}-\d{2}-\d{2}/.test(fecha) ? formatearFechaInput(fecha.slice(0, 10)) : fecha)

/** Nombre de campo del backend → nombre de campo del formulario (para marcar el input con error). */
const CAMPOS_FRONT: Record<string, string> = { nombreDueno: 'dueño', correoDueno: 'correoDueño' }

function resultadoError(error: unknown, campoPorDefecto = 'general'): { ok: false; campo: string; mensaje: string } {
  const campo = error instanceof ApiError && error.campo ? (CAMPOS_FRONT[error.campo] ?? error.campo) : campoPorDefecto
  return { ok: false, campo, mensaje: mensajeDeError(error) }
}

export function mascotaDesdeApi(m: MascotaApi): Mascota {
  return {
    id: String(m.id),
    nombre: m.nombre,
    especie: m.especie as Especie,
    raza: m.raza ?? '',
    edad: m.edad ?? '',
    sexo: (m.sexo ?? '') as Sexo,
    peso: m.peso ?? '',
    dueño: m.nombreDueno,
    correoDueño: m.correoDueno,
    completo: m.completo,
    imagen: m.imagen ?? '',
    estado: (m.estado ?? 'al-dia') as EstadoMascota,
    descripcion: m.descripcion ?? '',
  }
}

/** Cuerpo que espera POST/PUT /mascotas (MascotaRequest del backend). */
function mascotaHaciaApi(m: NuevaMascota) {
  return {
    nombre: m.nombre.trim(),
    especie: m.especie,
    raza: vacioANull(m.raza),
    edad: vacioANull(m.edad),
    sexo: vacioANull(m.sexo),
    peso: vacioANull(m.peso),
    nombreDueno: m.dueño.trim(),
    correoDueno: m.correoDueño.trim(),
    imagen: vacioANull(m.imagen),
    estado: m.estado,
    descripcion: vacioANull(m.descripcion),
  }
}

export function solicitudDesdeApi(s: SolicitudApi): SolicitudCambio {
  return {
    id: String(s.id),
    mascotaId: String(s.mascotaId),
    correoSolicitante: s.correoSolicitante,
    cambios: {
      raza: s.raza ?? '',
      sexo: (s.sexo ?? '') as Sexo,
      peso: s.peso ?? '',
      imagen: s.imagen ?? '',
      descripcion: s.descripcion ?? '',
    },
    estado: s.estado as EstadoSolicitud,
    fechaSolicitud: s.fechaSolicitud,
    fechaResolucion: s.fechaResolucion,
  }
}

export function atencionDesdeApi(a: AtencionApi): RegistroClinico {
  return {
    id: String(a.id),
    fecha: aTexto(a.fecha),
    motivo: a.motivo,
    diagnostico: a.diagnostico,
    tratamiento: a.tratamiento,
    veterinario: a.veterinario,
    servicios: a.servicios ?? [],
  }
}

export function vacunaDesdeApi(v: VacunaApi): RegistroVacuna {
  return {
    id: String(v.id),
    vacuna: v.vacuna,
    fecha: aTexto(v.fecha),
    proximoRefuerzo: aTexto(v.proximoRefuerzo),
    estado: v.estado as EstadoVacuna,
  }
}

/* =========================================================
   MASCOTAS — mascota-service (8082)
========================================================= */

/**
 * Todas las mascotas que el usuario puede ver.
 * El backend decide según el token: el personal ve todas y un cliente solo las suyas.
 */
export async function listarMascotas(): Promise<Mascota[]> {
  const lista = await pedir<MascotaApi[]>('mascota', '/mascotas')
  return lista.map(mascotaDesdeApi)
}

/** Mascotas de un dueño/a (vista "Mis mascotas" y perfil): aunque sea personal, solo ve las suyas. */
export async function listarMascotasPorDueno(correo: string): Promise<Mascota[]> {
  const objetivo = correo.trim().toLowerCase()
  return (await listarMascotas()).filter((m) => m.correoDueño.trim().toLowerCase() === objetivo)
}

/**
 * Una mascota por id. Devuelve null si no existe (404), si el id no es válido (400)
 * o si es de otro dueño (403): en los tres casos la página muestra "Mascota no encontrada".
 */
export async function obtenerMascotaPorId(id: string): Promise<Mascota | null> {
  if (!/^\d+$/.test(id)) return null
  try {
    return mascotaDesdeApi(await pedir<MascotaApi>('mascota', `/mascotas/${id}`))
  } catch (error) {
    if (error instanceof ApiError && [400, 403, 404].includes(error.status)) return null
    throw error
  }
}

/* =========================================================
   CRUD (lo usa el panel admin)
========================================================= */

export async function crearMascota(datos: NuevaMascota): Promise<ResultadoOperacion<Mascota>> {
  // Validaciones rápidas en el navegador (el backend vuelve a validar todo)
  const errorNombre = validarRequerido(datos.nombre, 'El nombre', 40)
  if (errorNombre) return { ok: false, campo: 'nombre', mensaje: errorNombre }

  try {
    const creada = await pedir<MascotaApi>('mascota', '/mascotas', { metodo: 'POST', cuerpo: mascotaHaciaApi(datos) })
    return { ok: true, dato: mascotaDesdeApi(creada) }
  } catch (error) {
    return resultadoError(error)
  }
}

/**
 * Actualiza una mascota. El backend (PUT) necesita la mascota completa,
 * así que se lee la actual y se mezclan los cambios (ej: solo { estado }).
 */
export async function actualizarMascota(id: string, cambios: CambiosMascota): Promise<ResultadoOperacion<Mascota>> {
  if (cambios.nombre !== undefined) {
    const errorNombre = validarRequerido(cambios.nombre, 'El nombre', 40)
    if (errorNombre) return { ok: false, campo: 'nombre', mensaje: errorNombre }
  }

  try {
    const actual = await obtenerMascotaPorId(id)
    if (!actual) return { ok: false, campo: 'id', mensaje: 'La mascota no existe.' }
    const actualizada = await pedir<MascotaApi>('mascota', `/mascotas/${id}`, {
      metodo: 'PUT',
      cuerpo: mascotaHaciaApi({ ...actual, ...cambios }),
    })
    return { ok: true, dato: mascotaDesdeApi(actualizada) }
  } catch (error) {
    return resultadoError(error)
  }
}

/** Elimina la mascota (solo ADMIN; el backend borra también sus solicitudes). */
export async function eliminarMascota(id: string): Promise<ResultadoOperacion<true>> {
  try {
    await pedir<void>('mascota', `/mascotas/${id}`, { metodo: 'DELETE' })
    return { ok: true, dato: true }
  } catch (error) {
    return resultadoError(error)
  }
}

/* =========================================================
   FILTROS (función pura: se puede probar por separado)
========================================================= */

export function filtrarMascotas(lista: Mascota[], filtros: FiltrosMascotas): Mascota[] {
  const texto = filtros.texto.trim().toLowerCase()
  const favoritos = obtenerFavoritos()
  return lista.filter(
    (m) =>
      (!texto || m.nombre.toLowerCase().includes(texto)) &&
      (!filtros.especie || m.especie === filtros.especie) &&
      (!filtros.soloFavoritas || favoritos.includes(m.id)),
  )
}

/* =========================================================
   FAVORITOS (siguen en localStorage: es una preferencia del navegador)
========================================================= */

export function obtenerFavoritos(): string[] {
  return leerObjeto<string[]>(CLAVES.favoritosMascotas) ?? []
}

export function esFavorita(id: string): boolean {
  return obtenerFavoritos().includes(id)
}

/** Agrega/quita el id de favoritos y devuelve el nuevo estado (true = quedó como favorita). */
export function alternarFavorita(id: string): boolean {
  const favoritos = obtenerFavoritos()
  const indice = favoritos.indexOf(id)
  if (indice === -1) favoritos.push(id)
  else favoritos.splice(indice, 1)
  guardarObjeto(CLAVES.favoritosMascotas, favoritos)
  return favoritos.includes(id)
}

/* =========================================================
   HISTORIAL CLÍNICO — historial-service (8083)
========================================================= */

/** Atenciones de una mascota, de la más reciente a la más antigua. */
export async function obtenerHistorial(idMascota: string): Promise<RegistroClinico[]> {
  const lista = await pedir<AtencionApi[]>('historial', `/historial/mascotas/${idMascota}/atenciones`)
  return lista.map(atencionDesdeApi)
}

/** Registra una atención nueva (ADMIN o RECEPCIONISTA). */
export async function agregarRegistroClinico(idMascota: string, registro: RegistroClinico): Promise<RegistroClinico> {
  const creada = await pedir<AtencionApi>('historial', `/historial/mascotas/${idMascota}/atenciones`, {
    metodo: 'POST',
    cuerpo: {
      fecha: aIso(registro.fecha),
      motivo: registro.motivo,
      diagnostico: registro.diagnostico,
      tratamiento: registro.tratamiento,
      veterinario: registro.veterinario,
      servicios: registro.servicios ?? [],
    },
  })
  return atencionDesdeApi(creada)
}

/* =========================================================
   VACUNAS — historial-service (8083)
========================================================= */

/** Vacunas de una mascota con su estado (al-dia / proxima / atrasada) calculado por el backend. */
export async function obtenerVacunas(idMascota: string): Promise<RegistroVacuna[]> {
  const lista = await pedir<VacunaApi[]>('historial', `/historial/mascotas/${idMascota}/vacunas`)
  return lista.map(vacunaDesdeApi)
}

/**
 * Registra una vacuna. Hay una sola entrada por vacuna (igual que en la EP2):
 * si la mascota ya tenía esa vacuna (ej: refuerzo atrasado), se ACTUALIZA ese registro (PUT);
 * si no la tenía, se crea uno nuevo (POST).
 */
export async function agregarVacuna(idMascota: string, registro: RegistroVacuna): Promise<RegistroVacuna> {
  const cuerpo = {
    vacuna: registro.vacuna.trim(),
    fecha: aIso(registro.fecha),
    proximoRefuerzo: aIso(registro.proximoRefuerzo),
  }
  const nombre = cuerpo.vacuna.toLowerCase()
  const existente = (await obtenerVacunas(idMascota)).find((v) => v.vacuna.trim().toLowerCase() === nombre)

  const guardada = existente?.id
    ? await pedir<VacunaApi>('historial', `/historial/vacunas/${existente.id}`, { metodo: 'PUT', cuerpo })
    : await pedir<VacunaApi>('historial', `/historial/mascotas/${idMascota}/vacunas`, { metodo: 'POST', cuerpo })
  return vacunaDesdeApi(guardada)
}

/** Elimina un registro de vacuna por su id (solo ADMIN). */
export async function eliminarVacuna(idVacuna: string): Promise<void> {
  await pedir<void>('historial', `/historial/vacunas/${idVacuna}`, { metodo: 'DELETE' })
}

/* =========================================================
   SOLICITUDES DE CAMBIO — mascota-service (8082)
========================================================= */

/** Todas las solicitudes (solo personal: ADMIN o RECEPCIONISTA). */
export async function listarSolicitudes(): Promise<SolicitudCambio[]> {
  const lista = await pedir<SolicitudApi[]>('mascota', '/solicitudes')
  return lista.map(solicitudDesdeApi)
}

/** Solicitudes que esperan aprobación (panel admin). */
export async function listarSolicitudesPendientes(): Promise<SolicitudCambio[]> {
  const lista = await pedir<SolicitudApi[]>('mascota', '/solicitudes?estado=pendiente')
  return lista.map(solicitudDesdeApi)
}

/**
 * Solicitudes de UNA mascota, de la más reciente a la más antigua.
 * La puede pedir el dueño/a (para ver si su cambio fue aprobado) o el personal.
 */
export async function listarSolicitudesDeMascota(mascotaId: string): Promise<SolicitudCambio[]> {
  const lista = await pedir<SolicitudApi[]>('mascota', `/mascotas/${mascotaId}/solicitudes`)
  return lista.map(solicitudDesdeApi)
}

/**
 * El dueño/a propone cambios desde su perfil o desde el detalle de la mascota.
 * Regla del backend:
 * - mascota INCOMPLETA → los datos se aplican al tiro (solicitud "aprobada")
 * - mascota COMPLETA   → queda "pendiente" hasta que el personal la apruebe o rechace
 * - solo una solicitud pendiente por mascota (si no, responde 409)
 */
export async function enviarCambiosMascota(
  idMascota: string,
  cambios: CambiosSolicitud,
): Promise<ResultadoOperacion<SolicitudCambio>> {
  const errorRaza = validarRequerido(cambios.raza, 'La raza', 40)
  if (errorRaza) return { ok: false, campo: 'raza', mensaje: errorRaza }

  try {
    const creada = await pedir<SolicitudApi>('mascota', `/mascotas/${idMascota}/solicitudes`, {
      metodo: 'POST',
      cuerpo: {
        raza: vacioANull(cambios.raza),
        sexo: vacioANull(cambios.sexo),
        peso: vacioANull(cambios.peso),
        imagen: vacioANull(cambios.imagen),
        descripcion: (cambios.descripcion ?? '').trim(),
      },
    })
    return { ok: true, dato: solicitudDesdeApi(creada) }
  } catch (error) {
    return resultadoError(error)
  }
}

/** Aprueba (aplica los cambios) o rechaza una solicitud pendiente. */
async function resolverSolicitud(id: string, accion: 'aprobar' | 'rechazar'): Promise<ResultadoOperacion<SolicitudCambio>> {
  try {
    const resuelta = await pedir<SolicitudApi>('mascota', `/solicitudes/${id}/${accion}`, { metodo: 'PUT' })
    return { ok: true, dato: solicitudDesdeApi(resuelta) }
  } catch (error) {
    return resultadoError(error)
  }
}

export const aprobarSolicitud = (id: string) => resolverSolicitud(id, 'aprobar')
export const rechazarSolicitud = (id: string) => resolverSolicitud(id, 'rechazar')
