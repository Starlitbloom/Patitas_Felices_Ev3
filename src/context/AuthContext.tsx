/* =========================================================
   AuthContext — estado global de la sesión.
   Guarda en un useState al usuario conectado y lo comparte
   con toda la app (header, rutas protegidas, perfil, admin)
   sin tener que pasarlo por props de componente en componente.

   EP3 — sesión con JWT que sobrevive a recargar la página:
   1. Al cargar, muestra al instante la sesión guardada en localStorage.
   2. En paralelo confirma con auth-service (GET /auth/me) que el token
      sigue vigente. Si venció, api.ts lo renueva con el refreshToken;
      si no se puede renovar, la sesión se cierra.
   3. Escucha el evento "sesión expirada" que dispara api.ts cuando
      cualquier petición descubre que la sesión ya no es válida.
========================================================= */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { NuevoUsuario, ResultadoOperacion, Usuario, UsuarioSesion } from '../types/usuario'
import * as sesionService from '../services/sesionService'
import { EVENTO_SESION_EXPIRADA } from '../services/api'

interface AuthContextValor {
  usuario: UsuarioSesion | null
  /** true mientras se confirma con el backend la sesión guardada (al recargar la página). */
  cargando: boolean
  esAdmin: boolean
  /** Personal de la clínica (admin o recepcionista): puede entrar al panel. */
  esPersonal: boolean
  iniciarSesion: (correo: string, password: string) => Promise<ResultadoOperacion<UsuarioSesion>>
  registrarse: (datos: NuevoUsuario) => Promise<ResultadoOperacion<UsuarioSesion>>
  cerrarSesion: () => void
  /** Refresca la sesión después de editar los datos del usuario conectado. */
  refrescarSesion: (usuarioActualizado: Usuario) => void
}

const AuthContext = createContext<AuthContextValor | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Valor inicial: la sesión guardada (si el usuario recarga la página, sigue conectado)
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(() => (sesionService.hayToken() ? sesionService.obtenerSesion() : null))
  const [cargando, setCargando] = useState(() => sesionService.hayToken())

  // Al montar: confirmar con el backend que el token guardado sigue siendo válido
  useEffect(() => {
    if (!sesionService.hayToken()) return
    let activo = true
    sesionService.restaurarSesion().then((u) => {
      if (!activo) return
      setUsuario(u)
      setCargando(false)
    })
    return () => {
      activo = false
    }
  }, [])

  // Si cualquier petición descubre que la sesión venció, se cierra en toda la app
  useEffect(() => {
    const alExpirar = () => {
      sesionService.cerrarSesion()
      setUsuario(null)
    }
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar)
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar)
  }, [])

  const iniciarSesion: AuthContextValor['iniciarSesion'] = async (correo, password) => {
    const resultado = await sesionService.autenticar(correo, password)
    if (resultado.ok) setUsuario(resultado.dato)
    return resultado
  }

  const registrarse: AuthContextValor['registrarse'] = async (datos) => {
    const resultado = await sesionService.registrar(datos)
    if (resultado.ok) setUsuario(resultado.dato)
    return resultado
  }

  const cerrarSesion = () => {
    sesionService.cerrarSesion()
    setUsuario(null)
  }

  const refrescarSesion = (usuarioActualizado: Usuario) => {
    setUsuario(sesionService.guardarSesion(usuarioActualizado))
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        cargando,
        esAdmin: usuario?.rol === 'admin',
        esPersonal: usuario?.rol === 'admin' || usuario?.rol === 'recepcionista',
        iniciarSesion,
        registrarse,
        cerrarSesion,
        refrescarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValor {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return contexto
}
