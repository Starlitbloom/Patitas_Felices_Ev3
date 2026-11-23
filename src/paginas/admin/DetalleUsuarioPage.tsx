/* PÁGINA (contenedor) — Detalle de un usuario: /admin/usuarios/:id
   Lee el parámetro "id" de la URL con useParams y busca al usuario.
   Desde aquí también se puede editar, eliminar o exportar.
   EP3: el usuario se pide a auth-service (GET /usuarios/{id}). */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { actualizarUsuario, eliminarUsuario, obtenerUsuarioPorId } from '../../services/usuariosService'
import { useAuth } from '../../context/AuthContext'
import { mensajeDeError } from '../../services/api'
import type { Usuario } from '../../types/usuario'
import { exportarUsuarios } from '../../utils/exportarExcel'
import { EncabezadoAdmin } from '../../componentes/organismos/EncabezadoAdmin'
import { DetalleUsuario } from '../../componentes/organismos/DetalleUsuario'
import { Modal } from '../../componentes/organismos/Modal'
import { ModalConfirmacion } from '../../componentes/organismos/ModalConfirmacion'
import { FormularioUsuario, type DatosFormularioUsuario } from '../../componentes/organismos/FormularioUsuario'

export default function DetalleUsuarioPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario: sesion, refrescarSesion } = useAuth()

  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    let activo = true
    obtenerUsuarioPorId(id)
      .then((u) => activo && setUsuario(u))
      .catch((e) => activo && setError(mensajeDeError(e)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [id])

  if (cargando) return <p className="admin-tabla-vacia">Cargando usuario…</p>

  if (error) {
    return (
      <>
        <EncabezadoAdmin>Detalle del usuario</EncabezadoAdmin>
        <p className="admin-tabla-vacia" role="alert">
          {error}
        </p>
      </>
    )
  }

  if (!usuario) {
    return (
      <>
        <EncabezadoAdmin>Usuario no encontrado</EncabezadoAdmin>
        <p className="admin-tabla-vacia">No existe un usuario con el identificador "{id}".</p>
        <Link to="/admin/usuarios" className="admin-btn-limpiar d-inline-block">
          ← Volver al listado
        </Link>
      </>
    )
  }

  const guardar = async (datos: DatosFormularioUsuario) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password2, run, ...cambios } = datos
    const resultado = await actualizarUsuario(usuario.id, cambios)
    if (!resultado.ok) return { campo: resultado.campo, mensaje: resultado.mensaje }
    if (resultado.dato.id === sesion?.id) refrescarSesion(resultado.dato)
    setUsuario(resultado.dato)
    setEditando(false)
  }

  const eliminar = async () => {
    const resultado = await eliminarUsuario(usuario.id)
    setConfirmando(false)
    if (!resultado.ok) return setError(resultado.mensaje) // ej: cuenta fija del sistema
    navigate('/admin/usuarios', { replace: true })
  }

  return (
    <>
      <EncabezadoAdmin>Detalle del usuario 🐾</EncabezadoAdmin>
      <Link to="/admin/usuarios" className="admin-volver">
        ← Volver al listado
      </Link>

      <DetalleUsuario
        usuario={usuario}
        puedeEliminar={usuario.id !== sesion?.id}
        onEditar={() => setEditando(true)}
        onEliminar={() => setConfirmando(true)}
        onExportar={() => exportarUsuarios([usuario], `usuario-${usuario.correo.split('@')[0]}`)}
      />

      <Modal abierto={editando} titulo="Editar usuario" onCerrar={() => setEditando(false)} ancho>
        <FormularioUsuario modo="editar" valoresIniciales={usuario} onSubmit={guardar} onCancelar={() => setEditando(false)} />
      </Modal>

      <ModalConfirmacion
        abierto={confirmando}
        titulo="Eliminar usuario"
        mensaje={`¿Eliminar la cuenta de ${usuario.nombre} ${usuario.apellidos}? Esta acción no se puede deshacer.`}
        onConfirmar={eliminar}
        onCancelar={() => setConfirmando(false)}
      />
    </>
  )
}
