/* PÁGINA (contenedor) — Registro (antes registro.html).
   EP3: crea la cuenta en auth-service (POST /auth/registro), que la deja
   como cliente y responde con el token: la sesión queda iniciada de inmediato. */
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FormularioUsuario, type DatosFormularioUsuario } from '../componentes/organismos/FormularioUsuario'
import { Etiqueta } from '../componentes/atomos/Etiqueta'

export default function RegistroPage() {
  const { registrarse } = useAuth()
  const navigate = useNavigate()
  // Página que la persona quería ver antes de registrarse (ej.: Solicitar cita con una hora elegida)
  const desde = (useLocation().state as { desde?: string } | null)?.desde

  const registrar = async (datos: DatosFormularioUsuario) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password2, ...resto } = datos
    const resultado = await registrarse({ ...resto, rol: 'cliente', activo: true })
    if (!resultado.ok) return { campo: resultado.campo, mensaje: resultado.mensaje }
    navigate(desde ?? '/perfil') // registro exitoso = sesión iniciada
  }

  return (
    <main className="seccion-formulario">
      <div className="contenedor">
        <div className="formulario-cabecera">
          <Etiqueta>Únete a Patitas Felices</Etiqueta>
          <h1>Crea tu cuenta</h1>
          <p>Regístrate para agendar citas y llevar el historial de tu mascota.</p>
        </div>
        <div className="tarjeta-formulario tarjeta-formulario--ancha tarjeta-formulario--plana">
          <FormularioUsuario modo="registro" onSubmit={registrar} />
        </div>
        <p className="formulario-pie">
          ¿Ya tienes cuenta? <Link to="/login" state={{ desde }}>Inicia sesión</Link>
        </p>
      </div>
    </main>
  )
}
