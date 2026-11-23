/* =========================================================
   usuariosService — módulo de usuarios conectado a auth-service.
   EP3: ya no usa localStorage; cada operación es una petición HTTP:
     C → crearUsuario         POST   /usuarios        (solo ADMIN)
     R → listarUsuarios        GET    /usuarios        (solo ADMIN)
         obtenerUsuarioPorId   GET    /usuarios/{id}
     U → actualizarUsuario     PUT    /usuarios/{id}
     D → eliminarUsuario       DELETE /usuarios/{id}   (solo ADMIN)
   Los permisos los decide el backend según el rol del token.
   Las páginas siguen recibiendo el mismo tipo Usuario de siempre:
   este archivo traduce entre el formato de la API y el del frontend.
========================================================= */
import type { CambiosUsuario, FiltrosUsuarios, NuevoUsuario, ResultadoOperacion, Rol, Usuario, UsuarioApi } from '../types/usuario'
import { ApiError, mensajeDeError, pedir } from './api'

/* ---------------- Conversión API ⇄ frontend ---------------- */

/** Respuesta de auth-service → Usuario del frontend. */
export function desdeApi(u: UsuarioApi): Usuario {
  return {
    id: String(u.id),
    run: u.run,
    nombre: u.nombre,
    apellidos: u.apellidos,
    correo: u.correo,
    password: '', // nunca viene del backend
    telefono: u.telefono ?? '',
    region: u.region ?? '',
    comuna: u.comuna ?? '',
    direccion: u.direccion ?? '',
    rol: u.rol.nombre.toLowerCase() as Rol, // "ADMIN" → "admin"
    activo: u.activo !== false,
    avatar: u.avatar ?? undefined,
    fechaRegistro: u.fechaRegistro ?? '',
  }
}

/** Datos del frontend → cuerpo que espera auth-service. */
export function haciaApi(datos: CambiosUsuario): Record<string, unknown> {
  const { rol, password, ...resto } = datos
  const cuerpo: Record<string, unknown> = { ...resto }
  if (rol) cuerpo.rol = { nombre: rol.toUpperCase() } // "admin" → { nombre: "ADMIN" }
  if (password) cuerpo.password = password // vacía = no se cambia
  return cuerpo
}

/** Convierte un error de la API en el resultado que entienden los formularios. */
export function aResultadoError(error: unknown, campoPorDefecto = 'correo'): { ok: false; campo: string; mensaje: string } {
  const campo = error instanceof ApiError && error.campo ? error.campo : campoPorDefecto
  return { ok: false, campo, mensaje: mensajeDeError(error) }
}

/* ---------------- LEER (Read) ---------------- */

export async function listarUsuarios(): Promise<Usuario[]> {
  const usuarios = await pedir<UsuarioApi[]>('auth', '/usuarios')
  return usuarios.map(desdeApi)
}

/** Devuelve null si el usuario no existe (404). */
export async function obtenerUsuarioPorId(id: string): Promise<Usuario | null> {
  try {
    return desdeApi(await pedir<UsuarioApi>('auth', `/usuarios/${encodeURIComponent(id)}`))
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null
    throw error
  }
}

/* ---------------- CREAR (Create) — panel admin ---------------- */

export async function crearUsuario(datos: NuevoUsuario): Promise<ResultadoOperacion<Usuario>> {
  try {
    const creado = await pedir<UsuarioApi>('auth', '/usuarios', { metodo: 'POST', cuerpo: { ...haciaApi(datos), password: datos.password } })
    return { ok: true, dato: desdeApi(creado) }
  } catch (error) {
    return aResultadoError(error)
  }
}

/* ---------------- ACTUALIZAR (Update) ---------------- */

export async function actualizarUsuario(id: string, cambios: CambiosUsuario): Promise<ResultadoOperacion<Usuario>> {
  try {
    const actualizado = await pedir<UsuarioApi>('auth', `/usuarios/${encodeURIComponent(id)}`, {
      metodo: 'PUT',
      cuerpo: haciaApi(cambios),
    })
    return { ok: true, dato: desdeApi(actualizado) }
  } catch (error) {
    return aResultadoError(error)
  }
}

/* ---------------- ELIMINAR (Delete) ---------------- */

export async function eliminarUsuario(id: string): Promise<ResultadoOperacion<true>> {
  try {
    await pedir<void>('auth', `/usuarios/${encodeURIComponent(id)}`, { metodo: 'DELETE' })
    return { ok: true, dato: true }
  } catch (error) {
    return aResultadoError(error, 'id')
  }
}

/* ---------------- FILTRAR (búsqueda en pantalla, sin llamar a la API) ---------------- */

/** Aplica texto, rol y orden al listado ya cargado. */
export function filtrarUsuarios(usuarios: Usuario[], filtros: FiltrosUsuarios): Usuario[] {
  const texto = filtros.texto.trim().toLowerCase()
  let resultado = usuarios.filter((u) => {
    const coincideTexto =
      !texto || `${u.run} ${u.nombre} ${u.apellidos} ${u.correo}`.toLowerCase().includes(texto)
    const coincideRol = !filtros.rol || u.rol === filtros.rol
    return coincideTexto && coincideRol
  })

  if (filtros.orden === 'az') {
    resultado = [...resultado].sort((a, b) => a.nombre.localeCompare(b.nombre))
  } else if (filtros.orden === 'za') {
    resultado = [...resultado].sort((a, b) => b.nombre.localeCompare(a.nombre))
  } else {
    resultado = [...resultado].sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro))
  }
  return resultado
}
