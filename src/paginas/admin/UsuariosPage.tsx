/* PÁGINA (contenedor) — Gestión de usuarios (antes admin/usuarios.html).
   Aquí se integran las 4 operaciones CRUD y los filtros de búsqueda:
     C → modal "Nuevo usuario"     (crearUsuario)
     R → tabla + vista de detalle  (listarUsuarios, /admin/usuarios/:id)
     U → modal "Editar"            (actualizarUsuario)
     D → confirmación "Eliminar"   (eliminarUsuario)
   Toda la información que cambia está en useState; después de cada
   operación se vuelve a leer la lista para reflejar los cambios.
   EP3: cada operación es una petición a auth-service (solo ADMIN). */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FiltrosUsuarios as Filtros, Usuario } from '../../types/usuario'
import {
  actualizarUsuario,
  crearUsuario,
  eliminarUsuario,
  filtrarUsuarios,
  listarUsuarios,
} from '../../services/usuariosService'
import { useAuth } from '../../context/AuthContext'
import { mensajeDeError } from '../../services/api'
import { exportarUsuarios } from '../../utils/exportarExcel'
import { EncabezadoAdmin } from '../../componentes/organismos/EncabezadoAdmin'
import { FiltrosUsuarios } from '../../componentes/organismos/FiltrosUsuarios'
import { TablaUsuarios } from '../../componentes/organismos/TablaUsuarios'
import { Modal } from '../../componentes/organismos/Modal'
import { ModalConfirmacion } from '../../componentes/organismos/ModalConfirmacion'
import { FormularioUsuario, type DatosFormularioUsuario } from '../../componentes/organismos/FormularioUsuario'
import { AccesoRapido } from '../../componentes/moleculas/AccesoRapido'

const FILTROS_INICIALES: Filtros = { texto: '', rol: '', orden: 'recientes' }

type EstadoModal = { tipo: 'crear' } | { tipo: 'editar'; usuario: Usuario } | null

export default function UsuariosPage() {
  const { usuario: sesion, refrescarSesion } = useAuth()
  const navigate = useNavigate()

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<EstadoModal>(null)
  const [aEliminar, setAEliminar] = useState<Usuario | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const visibles = filtrarUsuarios(usuarios, filtros)

  /** Vuelve a pedir la lista a auth-service (al entrar y después de cada cambio). */
  const recargar = useCallback(async () => {
    try {
      setUsuarios(await listarUsuarios())
      setErrorCarga(null)
    } catch (error) {
      setErrorCarga(mensajeDeError(error))
    } finally {
      setCargando(false)
    }
  }, [])

  // Carga inicial (la promesa actualiza el estado cuando responde auth-service)
  useEffect(() => {
    let activo = true
    listarUsuarios()
      .then((lista) => activo && setUsuarios(lista))
      .catch((error) => activo && setErrorCarga(mensajeDeError(error)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  /* ---------- Selección (checkboxes) ---------- */
  const seleccionar = (id: string, marcado: boolean) => {
    setSeleccionados((prev) => {
      const copia = new Set(prev)
      if (marcado) copia.add(id)
      else copia.delete(id)
      return copia
    })
  }
  const seleccionarTodos = (marcado: boolean) =>
    setSeleccionados(marcado ? new Set(visibles.map((u) => u.id)) : new Set())

  /* ---------- CREAR ---------- */
  const crear = async (datos: DatosFormularioUsuario) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password2, ...nuevo } = datos
    const resultado = await crearUsuario(nuevo)
    if (!resultado.ok) return { campo: resultado.campo, mensaje: resultado.mensaje }
    await recargar()
    setModal(null)
    setAviso(`Usuario ${resultado.dato.nombre} creado correctamente.`)
  }

  /* ---------- ACTUALIZAR ---------- */
  const editar = (id: string) => async (datos: DatosFormularioUsuario) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password2, run, ...cambios } = datos // el RUN no se modifica
    const resultado = await actualizarUsuario(id, cambios)
    if (!resultado.ok) return { campo: resultado.campo, mensaje: resultado.mensaje }
    if (resultado.dato.id === sesion?.id) refrescarSesion(resultado.dato) // si el admin se editó a sí mismo
    await recargar()
    setModal(null)
    setAviso(`Cambios de ${resultado.dato.nombre} guardados.`)
  }

  /* ---------- ELIMINAR ---------- */
  const confirmarEliminacion = async () => {
    if (!aEliminar) return
    const resultado = await eliminarUsuario(aEliminar.id)
    // Ej: las cuentas fijas del sistema no se pueden eliminar (lo decide el backend)
    setAviso(resultado.ok ? `Usuario ${aEliminar.nombre} eliminado.` : resultado.mensaje)
    if (resultado.ok) seleccionar(aEliminar.id, false)
    setAEliminar(null)
    await recargar()
  }

  return (
    <>
      <EncabezadoAdmin>Gestión de usuarios 🐾</EncabezadoAdmin>

      <section className="admin-accesos admin-accesos--usuarios">
        <AccesoRapido
          icono="/img/icono-nuevo-usuario.png"
          titulo="Nuevo usuario"
          descripcion="Crea una cuenta con datos completos."
          onClick={() => setModal({ tipo: 'crear' })}
        />
        <AccesoRapido
          icono="/img/icono-mostrar-usuarios.png"
          titulo="Reportes"
          descripcion="Revisa estadísticas de usuarios, mascotas y citas."
          to="/admin/reportes"
        />
      </section>

      {aviso && (
        <div className="admin-aviso" role="status">
          {aviso}
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}

      <FiltrosUsuarios
        filtros={filtros}
        onCambio={setFiltros}
        onLimpiar={() => setFiltros(FILTROS_INICIALES)}
        onExportar={() => exportarUsuarios(usuarios.filter((u) => seleccionados.has(u.id)), 'usuarios-seleccionados')}
        cantidadSeleccionados={seleccionados.size}
        totalResultados={visibles.length}
      />

      {errorCarga && (
        <div className="admin-aviso admin-aviso--error" role="alert">
          {errorCarga}
          <button type="button" onClick={recargar} aria-label="Reintentar">
            ↻
          </button>
        </div>
      )}

      <section className="admin-tabla-seccion" aria-busy={cargando}>
        {cargando && <p className="admin-tabla-vacia">Cargando usuarios…</p>}
        <TablaUsuarios
          usuarios={visibles}
          idSesion={sesion?.id}
          seleccionados={seleccionados}
          onSeleccionar={seleccionar}
          onSeleccionarTodos={seleccionarTodos}
          onVer={(u) => navigate(`/admin/usuarios/${u.id}`)}
          onEditar={(u) => setModal({ tipo: 'editar', usuario: u })}
          onEliminar={setAEliminar}
        />
      </section>

      <Modal abierto={modal !== null} titulo={modal?.tipo === 'editar' ? 'Editar usuario' : 'Nuevo usuario'} onCerrar={() => setModal(null)} ancho>
        {modal?.tipo === 'crear' && <FormularioUsuario modo="crear" onSubmit={crear} onCancelar={() => setModal(null)} />}
        {modal?.tipo === 'editar' && (
          <FormularioUsuario
            key={modal.usuario.id}
            modo="editar"
            valoresIniciales={modal.usuario}
            onSubmit={editar(modal.usuario.id)}
            onCancelar={() => setModal(null)}
          />
        )}
      </Modal>

      <ModalConfirmacion
        abierto={aEliminar !== null}
        titulo="Eliminar usuario"
        mensaje={`¿Eliminar la cuenta de ${aEliminar?.nombre ?? ''} ${aEliminar?.apellidos ?? ''}? Esta acción no se puede deshacer.`}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setAEliminar(null)}
      />
    </>
  )
}
