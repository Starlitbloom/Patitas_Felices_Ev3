/* PÁGINA (contenedor) — Mi perfil (antes perfil.html).
   EP3: los cambios de datos y de foto se guardan en auth-service (PUT /usuarios/{id}).
   Estado de la página:
     - editando: alterna entre vista de solo lectura y formulario
     - errorAvatar: mensaje si la foto no se pudo guardar */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { actualizarUsuario } from '../services/usuariosService'
import { cargarMisCitas, type Cita } from '../services/citasService'
import { listarMascotasPorDueno } from '../services/mascotasService'
import { mensajeDeError } from '../services/api'
import type { Mascota } from '../types/mascota'
import { redimensionarImagen, validarArchivoAvatar } from '../utils/imagen'
import { CabeceraPerfil } from '../componentes/organismos/CabeceraPerfil'
import { FormularioUsuario, type DatosFormularioUsuario } from '../componentes/organismos/FormularioUsuario'
import { ListaPerfil } from '../componentes/organismos/ListaPerfil'
import { BloqueCompletarMascota } from '../componentes/organismos/BloqueCompletarMascota'
import { DatoPerfil } from '../componentes/moleculas/DatoPerfil'
import { Boton } from '../componentes/atomos/Boton'

export default function PerfilPage() {
  const { usuario, refrescarSesion, cerrarSesion } = useAuth()
  const navigate = useNavigate()
  const [editando, setEditando] = useState(false)
  const [errorAvatar, setErrorAvatar] = useState<string | null>(null)
  const [version, setVersion] = useState(0) // se incrementa al guardar una mascota para volver a leer la lista

  /* EP3: las mascotas del dueño vienen de mascota-service (8082) */
  const [misMascotas, setMisMascotas] = useState<Mascota[]>([])
  const [errorMascotas, setErrorMascotas] = useState<string | null>(null)
  const correo = usuario?.correo

  /* Se piden al entrar y cada vez que el dueño guarda cambios en una mascota (version) */
  useEffect(() => {
    if (!correo) return
    let activo = true
    listarMascotasPorDueno(correo)
      .then((lista) => {
        if (!activo) return
        setMisMascotas(lista)
        setErrorMascotas(null)
      })
      .catch((e) => activo && setErrorMascotas(mensajeDeError(e)))
    return () => {
      activo = false
    }
  }, [correo, version])

  /* EP3: las citas del usuario vienen de cita-service (GET /citas/mis-citas) */
  const [misCitas, setMisCitas] = useState<Cita[]>([])
  const [errorCitas, setErrorCitas] = useState<string | null>(null)
  useEffect(() => {
    if (!correo) return
    let activo = true
    cargarMisCitas()
      .then((lista) => {
        if (!activo) return
        setMisCitas(lista)
        setErrorCitas(null)
      })
      .catch((e) => activo && setErrorCitas(mensajeDeError(e)))
    return () => {
      activo = false
    }
  }, [correo])

  if (!usuario) return null // la ruta ya está protegida; esto solo satisface a TypeScript

  /* Fichas completas del dueño. Así también aparecen los controles de edición
     para mascotas registradas al solicitar una cita, sin depender de un resumen. */
  const mascotas = misMascotas.map((m) => ({
    id: m.id,
    titulo: m.nombre || 'Mascota',
    detalle: [m.especie, m.raza].filter(Boolean).join(' · '),
    imagen: m.imagen || undefined,
    extra: (
      <BloqueCompletarMascota key={`${m.id}-${version}`} mascota={m} onGuardado={() => setVersion((v) => v + 1)} />
    ),
  }))
  const citas = misCitas.map((c) => ({
    id: String(c.id),
    titulo: `${c.fecha} ${c.hora} — ${c.servicio || 'Consulta'}${c.mascota ? ` (${c.mascota})` : ''}`,
    detalle: c.estado,
  }))

  const guardar = async (datos: DatosFormularioUsuario) => {
    const correoAnterior = usuario.correo
    const resultado = await actualizarUsuario(usuario.id, {
      nombre: datos.nombre.trim(),
      apellidos: datos.apellidos.trim(),
      correo: datos.correo,
      telefono: datos.telefono.trim(),
      region: datos.region,
      comuna: datos.comuna,
      direccion: datos.direccion.trim(),
      password: datos.password, // vacío = se mantiene la actual
    })
    if (!resultado.ok) return { campo: resultado.campo, mensaje: resultado.mensaje }

    // El token JWT lleva el correo dentro: si se cambió, hay que volver a iniciar sesión
    if (resultado.dato.correo.toLowerCase() !== correoAnterior.toLowerCase()) {
      cerrarSesion()
      navigate('/login', { replace: true })
      return
    }
    refrescarSesion(resultado.dato)
    setEditando(false)
  }

  const cambiarAvatar = async (archivo: File) => {
    const error = validarArchivoAvatar(archivo)
    if (error) return setErrorAvatar(error)
    try {
      const base64 = await redimensionarImagen(archivo)
      const resultado = await actualizarUsuario(usuario.id, { avatar: base64 })
      if (!resultado.ok) return setErrorAvatar(resultado.mensaje)
      refrescarSesion(resultado.dato)
      setErrorAvatar(null)
    } catch {
      setErrorAvatar('No se pudo guardar la imagen. Prueba con otra foto.')
    }
  }

  return (
    <main className="perfil-pagina">
      <div className="contenedor">
        <CabeceraPerfil usuario={usuario} onCambiarAvatar={cambiarAvatar} errorAvatar={errorAvatar} />

        <div className="perfil-grid">
          <div className={`perfil-card perfil-card--editable ${editando ? 'perfil-card--editando' : ''}`.trim()}>
            {!editando && (
              <button type="button" className="perfil-card-editar" onClick={() => setEditando(true)}>
                <span>✏️</span> Editar
              </button>
            )}
            <h2>
              <span>👤</span> Sobre
            </h2>

            {editando ? (
              <FormularioUsuario
                modo="perfil"
                valoresIniciales={usuario}
                onSubmit={guardar}
                onCancelar={() => setEditando(false)}
              />
            ) : (
              <div className="perfil-sobre-vista">
                <DatoPerfil etiqueta="Nombre" valor={usuario.nombre} />
                <DatoPerfil etiqueta="Apellidos" valor={usuario.apellidos} />
                <DatoPerfil etiqueta="Correo" valor={usuario.correo} />
                <DatoPerfil etiqueta="Teléfono" valor={usuario.telefono} vacio="No registrado" />
                <DatoPerfil etiqueta="Región" valor={usuario.region} />
                <DatoPerfil etiqueta="Comuna" valor={usuario.comuna} />
                <DatoPerfil etiqueta="Dirección" valor={usuario.direccion} />
              </div>
            )}
          </div>

          <ListaPerfil
            titulo="Mis mascotas"
            icono="🐾"
            iconoItem="🐾"
            items={mascotas}
            textoVacio={errorMascotas ? `⚠️ ${errorMascotas}` : 'Aún no tienes mascotas registradas.'}
            enlace={{ to: '/solicitar-cita', texto: 'Agregar mascota' }}
          />
        </div>

        <ListaPerfil
          titulo="Mis citas"
          icono="📅"
          iconoItem="📅"
          items={citas}
          textoVacio={errorCitas ? `⚠️ ${errorCitas}` : 'Aún no tienes citas agendadas.'}
          enlace={{ to: '/solicitar-cita', texto: 'Solicitar una cita' }}
          ancha
        />

        <p className="perfil-cerrar-sesion-wrap">
          <Link to="/mis-mensajes" className="perfil-card-link me-3">
            ✉️ Mis mensajes de contacto
          </Link>
          <Boton
            onClick={() => {
              cerrarSesion()
              navigate('/')
            }}
          >
            Cerrar sesión
          </Boton>
        </p>
      </div>
    </main>
  )
}
