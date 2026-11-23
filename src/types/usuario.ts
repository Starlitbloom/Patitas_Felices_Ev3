/* =========================================================
   Tipos del módulo de usuarios.
   Centralizar los tipos aquí permite que servicios, páginas
   y componentes hablen "el mismo idioma" y que TypeScript
   avise si falta un campo o se usa uno que no existe.
========================================================= */

/**
 * Roles del sistema (control de acceso basado en roles, según el caso):
 * - admin: gestiona todo el sistema, incluidos usuarios y reportes
 * - recepcionista: personal de la clínica; gestiona citas y fichas, NO usuarios
 * - cliente: dueño/a de mascota
 */
export type Rol = 'cliente' | 'recepcionista' | 'admin'

/** Texto para mostrar cada rol en pantalla. */
export const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  recepcionista: 'Recepcionista',
  cliente: 'Dueño/a de mascota',
}

/** Usuario tal como lo usa el frontend (adaptado desde la respuesta de auth-service). */
export interface Usuario {
  id: string // el backend usa un número; aquí se guarda como texto para no cambiar los componentes
  run: string
  nombre: string
  apellidos: string
  correo: string
  password: string // el backend NUNCA la devuelve: llega vacía y solo se usa al crear o editar
  telefono: string
  region: string
  comuna: string
  direccion: string
  rol: Rol
  activo: boolean
  avatar?: string // foto comprimida en base64 (opcional)
  fechaRegistro: string // ISO, la usa el KPI "Nuevos esta semana"
}

/** Usuario tal como lo responde auth-service (GET /usuarios, /auth/me, login). */
export interface UsuarioApi {
  id: number
  run: string
  nombre: string
  apellidos: string
  correo: string
  telefono: string | null
  region: string | null
  comuna: string | null
  direccion: string | null
  activo: boolean
  avatar: string | null
  rol: { id?: number; nombre: string; descripcion?: string }
  fechaRegistro: string | null
}

/** Respuesta de login, registro y refresh en auth-service. */
export interface RespuestaAuth {
  token: string
  refreshToken: string
  tipo: string
  expiraEnMs: number
  usuario: UsuarioApi
}

/** Datos necesarios para crear un usuario (el servicio genera id y fecha). */
export type NuevoUsuario = Omit<Usuario, 'id' | 'fechaRegistro' | 'avatar'>

/** Campos que se pueden modificar de un usuario existente. */
export type CambiosUsuario = Partial<Omit<Usuario, 'id' | 'fechaRegistro'>>

/** Usuario en sesión: igual que Usuario pero SIN la contraseña. */
export type UsuarioSesion = Omit<Usuario, 'password'>

/** Opciones de orden del listado del panel admin. */
export type OrdenUsuarios = 'recientes' | 'az' | 'za'

/** Filtros de búsqueda del listado de usuarios. */
export interface FiltrosUsuarios {
  texto: string
  rol: '' | Rol
  orden: OrdenUsuarios
}

/**
 * Resultado de una operación del servicio. Si falla, indica qué campo
 * causó el problema para mostrar el mensaje junto a ese campo.
 */
export type ResultadoOperacion<T> =
  | { ok: true; dato: T }
  | { ok: false; campo: string; mensaje: string }

/** Mapa campo → mensaje de error (null = sin error). */
export type ErroresFormulario<C extends string> = Partial<Record<C, string | null>>
