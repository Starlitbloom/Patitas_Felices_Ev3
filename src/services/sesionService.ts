/* =========================================================
   sesionService — inicio de sesión, registro y cierre de sesión
   contra auth-service (EP3).

   En localStorage se guardan 3 cosas:
   - patitasFelices_token         → token JWT de acceso (30 min)
   - patitasFelices_refreshToken  → token para renovarlo (7 días)
   - patitasFelices_sesion        → datos del usuario SIN contraseña,
                                    para mostrar la sesión al instante al recargar
   Al recargar la página, AuthContext llama a restaurarSesion(), que
   confirma con el backend (GET /auth/me) que el token sigue siendo válido.
========================================================= */
import type { NuevoUsuario, RespuestaAuth, ResultadoOperacion, Usuario, UsuarioApi, UsuarioSesion } from '../types/usuario'
import { ApiError, borrarTokens, guardarTokens, obtenerToken, pedir } from './api'
import { CLAVES, borrar, guardarObjeto, leerObjeto } from './almacenamiento'
import { aResultadoError, desdeApi, haciaApi } from './usuariosService'

/** Quita la contraseña antes de guardar el usuario como sesión. */
export function aSesion(usuario: Usuario): UsuarioSesion {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...sinPassword } = usuario
  return sinPassword
}

export function obtenerSesion(): UsuarioSesion | null {
  return leerObjeto<UsuarioSesion>(CLAVES.sesion)
}

export function guardarSesion(usuario: Usuario | UsuarioSesion): UsuarioSesion {
  const sesion = aSesion({ password: '', ...usuario })
  guardarObjeto(CLAVES.sesion, sesion)
  return sesion
}

/** ¿Hay un token guardado? (no dice si sigue vigente: eso lo confirma restaurarSesion). */
export function hayToken(): boolean {
  return obtenerToken() !== null
}

export function cerrarSesion(): void {
  borrar(CLAVES.sesion)
  borrarTokens()
}

/** Guarda tokens y usuario después de un login o registro exitoso. */
function iniciarCon(respuesta: RespuestaAuth): UsuarioSesion {
  guardarTokens(respuesta.token, respuesta.refreshToken)
  return guardarSesion(desdeApi(respuesta.usuario))
}

/**
 * Inicia sesión con correo y contraseña (POST /auth/login).
 * Si falla, devuelve el campo con problema para mostrar el error junto a él.
 */
export async function autenticar(correo: string, password: string): Promise<ResultadoOperacion<UsuarioSesion>> {
  try {
    const respuesta = await pedir<RespuestaAuth>('auth', '/auth/login', {
      metodo: 'POST',
      cuerpo: { correo, password },
      sinToken: true,
    })
    return { ok: true, dato: iniciarCon(respuesta) }
  } catch (error) {
    return aResultadoError(error)
  }
}

/** Registro público (POST /auth/registro): la cuenta queda como cliente y con la sesión iniciada. */
export async function registrar(datos: NuevoUsuario): Promise<ResultadoOperacion<UsuarioSesion>> {
  try {
    const respuesta = await pedir<RespuestaAuth>('auth', '/auth/registro', {
      metodo: 'POST',
      cuerpo: { ...haciaApi(datos), password: datos.password },
      sinToken: true,
    })
    return { ok: true, dato: iniciarCon(respuesta) }
  } catch (error) {
    return aResultadoError(error)
  }
}

/**
 * Se llama al cargar la app. Confirma con el backend que el token guardado
 * sigue siendo válido (si venció, api.ts lo renueva solo con el refreshToken).
 * - Token válido      → devuelve el usuario actualizado desde la base de datos
 * - Sesión vencida    → cierra la sesión y devuelve null
 * - Backend apagado   → mantiene la sesión guardada (no se expulsa al usuario)
 */
export async function restaurarSesion(): Promise<UsuarioSesion | null> {
  if (!hayToken()) {
    cerrarSesion()
    return null
  }
  try {
    const usuario = await pedir<UsuarioApi>('auth', '/auth/me')
    return guardarSesion(desdeApi(usuario))
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0) {
      cerrarSesion()
      return null
    }
    return obtenerSesion()
  }
}
