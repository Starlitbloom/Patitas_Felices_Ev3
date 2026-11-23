/* Guardia de rutas por rol (reemplaza protegerRutaAdmin() de la EP1).
   EP3: el rol viene del backend (auth-service) dentro de la sesión, y además
   cada microservicio vuelve a revisar el rol del token en cada petición.
   - Mientras se verifica la sesión guardada → muestra "Verificando tu sesión…"
   - Sin sesión → redirige a /login
   - Con sesión pero sin un rol permitido → redirige al inicio
   Ejemplos:
     <RutaProtegida>                                  cualquier usuario con sesión
     <RutaProtegida roles={['admin', 'recepcionista']}>  solo personal de la clínica
     <RutaProtegida roles={['admin']}>                solo administradores */
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Rol } from '../types/usuario'

export interface RutaProtegidaProps {
  children: ReactNode
  /** Roles que pueden entrar. Si se omite, basta con tener sesión. */
  roles?: Rol[]
}

export function RutaProtegida({ children, roles }: RutaProtegidaProps) {
  const { usuario, cargando } = useAuth()
  const location = useLocation()

  // Al recargar la página: mientras se confirma el token con el backend no se redirige
  if (cargando && !usuario) {
    return (
      <p className="ruta-cargando" role="status">
        Verificando tu sesión…
      </p>
    )
  }
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname + location.search }} />
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/" replace />
  return <>{children}</>
}
