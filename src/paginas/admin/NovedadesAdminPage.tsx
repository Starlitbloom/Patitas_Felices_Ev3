/* PÁGINA (contenedor) — Gestión de novedades (nueva en EP3, solo administrador).
   Todo se guarda en novedad-service (puerto 8087):
     R → listar                    GET    /novedades
     C → publicar                  POST   /novedades
     U → editar / ocultar          PUT    /novedades/{id}
     D → eliminar                  DELETE /novedades/{id}
   Lo que se publica aquí aparece en /novedades y en la portada. */
import { useEffect, useState, type FormEvent } from 'react'
import { mensajeDeError } from '../../services/api'
import {
  actualizarNovedad,
  CATEGORIAS_NOVEDAD,
  crearNovedad,
  eliminarNovedad,
  formatearFechaNovedad,
  listarNovedadesApi,
  type DatosNovedad,
  type NovedadApi,
} from '../../services/novedadesService'
import { EncabezadoAdmin } from '../../componentes/organismos/EncabezadoAdmin'
import { Modal } from '../../componentes/organismos/Modal'
import { ModalConfirmacion } from '../../componentes/organismos/ModalConfirmacion'
import { Boton } from '../../componentes/atomos/Boton'

const VACIA: DatosNovedad = { titulo: '', descripcion: '', imagenUrl: '', categoria: 'Consejos', activa: true }

/** Validaciones iguales a las del backend (Novedad.java). */
function validar(datos: DatosNovedad): string | null {
  if (!datos.titulo.trim()) return 'El título es obligatorio.'
  if (datos.titulo.trim().length > 150) return 'El título no puede superar los 150 caracteres.'
  if (!datos.descripcion.trim()) return 'La descripción es obligatoria.'
  if (datos.descripcion.trim().length > 2000) return 'La descripción no puede superar los 2000 caracteres.'
  if (datos.imagenUrl.trim().length > 500) return 'La URL de la imagen no puede superar los 500 caracteres.'
  return null
}

export default function NovedadesAdminPage() {
  const [novedades, setNovedades] = useState<NovedadApi[]>([])
  const [cargando, setCargando] = useState(true)
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null)

  // Formulario: null = cerrado; id null = nueva novedad
  const [editando, setEditando] = useState<{ id: number | null; datos: DatosNovedad } | null>(null)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aEliminar, setAEliminar] = useState<NovedadApi | null>(null)

  const recargar = async () => {
    try {
      setNovedades(await listarNovedadesApi())
    } catch (error) {
      setAviso({ texto: mensajeDeError(error), error: true })
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    let activo = true
    listarNovedadesApi()
      .then((lista) => activo && setNovedades(lista))
      .catch((error) => activo && setAviso({ texto: mensajeDeError(error), error: true }))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  const abrirNueva = () => {
    setErrorForm(null)
    setEditando({ id: null, datos: { ...VACIA } })
  }

  const abrirEdicion = (n: NovedadApi) => {
    setErrorForm(null)
    setEditando({
      id: n.id,
      datos: {
        titulo: n.titulo,
        descripcion: n.descripcion,
        imagenUrl: n.imagenUrl ?? '',
        categoria: (CATEGORIAS_NOVEDAD as readonly string[]).includes(n.categoria ?? '')
          ? (n.categoria as DatosNovedad['categoria'])
          : 'Consejos',
        activa: n.activa !== false,
      },
    })
  }

  const cambiar = <K extends keyof DatosNovedad>(campo: K, valor: DatosNovedad[K]) =>
    setEditando((actual) => (actual ? { ...actual, datos: { ...actual.datos, [campo]: valor } } : actual))

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (!editando) return
    const datos = {
      ...editando.datos,
      titulo: editando.datos.titulo.trim(),
      descripcion: editando.datos.descripcion.trim(),
      imagenUrl: editando.datos.imagenUrl.trim(),
    }
    const error = validar(datos)
    if (error) return setErrorForm(error)

    setGuardando(true)
    try {
      if (editando.id === null) await crearNovedad(datos)
      else await actualizarNovedad(editando.id, datos)
      setAviso({ texto: editando.id === null ? 'Novedad publicada.' : 'Novedad actualizada.' })
      setEditando(null)
      await recargar()
    } catch (e) {
      setErrorForm(mensajeDeError(e))
    } finally {
      setGuardando(false)
    }
  }

  const confirmarEliminacion = async () => {
    if (!aEliminar) return
    const n = aEliminar
    setAEliminar(null)
    try {
      await eliminarNovedad(n.id)
      setAviso({ texto: `Se eliminó "${n.titulo}".` })
      await recargar()
    } catch (e) {
      setAviso({ texto: mensajeDeError(e), error: true })
    }
  }

  return (
    <>
      <EncabezadoAdmin>Novedades 📰</EncabezadoAdmin>

      {aviso && (
        <div className={`admin-aviso ${aviso.error ? 'admin-aviso--error' : ''}`.trim()} role="status">
          {aviso.texto}
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}

      <div className="admin-filtros-estado">
        <Boton variante="exportar" onClick={abrirNueva}>
          + Nueva novedad
        </Boton>
      </div>

      <section className="admin-tabla-seccion" aria-busy={cargando}>
        {cargando ? (
          <p className="admin-tabla-vacia">Cargando novedades…</p>
        ) : novedades.length === 0 ? (
          <p className="admin-tabla-vacia">Todavía no hay novedades publicadas.</p>
        ) : (
          <div className="admin-tabla-wrap table-responsive">
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Título</th>
                  <th>Categoría</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {novedades.map((n) => (
                  <tr key={n.id}>
                    <td>{formatearFechaNovedad(n.fechaPublicacion)}</td>
                    <td>{n.titulo}</td>
                    <td>{n.categoria ?? 'Consejos'}</td>
                    <td>
                      <span className={`admin-badge ${n.activa === false ? 'admin-badge--archivado' : 'admin-badge--respondido'}`}>
                        {n.activa === false ? 'Oculta' : 'Publicada'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-acciones-fila">
                        <Boton variante="editar" onClick={() => abrirEdicion(n)} aria-label={`Editar ${n.titulo}`}>
                          Editar
                        </Boton>
                        <Boton variante="eliminar" onClick={() => setAEliminar(n)} aria-label={`Eliminar ${n.titulo}`}>
                          Eliminar
                        </Boton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        abierto={editando !== null}
        titulo={editando?.id === null ? 'Nueva novedad' : 'Editar novedad'}
        onCerrar={() => setEditando(null)}
        ancho
      >
        {editando && (
          <form className="admin-mensaje-respuesta admin-novedad-form" onSubmit={(e) => void guardar(e)} noValidate>
            <label htmlFor="novedad-titulo" className="admin-modal-seccion">Título</label>
            <input
              id="novedad-titulo"
              className="admin-buscador"
              value={editando.datos.titulo}
              maxLength={150}
              onChange={(e) => cambiar('titulo', e.target.value)}
            />

            <label htmlFor="novedad-categoria" className="admin-modal-seccion">Categoría</label>
            <select
              id="novedad-categoria"
              className="admin-select"
              value={editando.datos.categoria}
              onChange={(e) => cambiar('categoria', e.target.value as DatosNovedad['categoria'])}
            >
              {CATEGORIAS_NOVEDAD.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>

            <label htmlFor="novedad-descripcion" className="admin-modal-seccion">Descripción</label>
            <textarea
              id="novedad-descripcion"
              value={editando.datos.descripcion}
              maxLength={2000}
              onChange={(e) => cambiar('descripcion', e.target.value)}
            />

            <label htmlFor="novedad-imagen" className="admin-modal-seccion">Imagen (ruta o URL, opcional)</label>
            <input
              id="novedad-imagen"
              className="admin-buscador"
              value={editando.datos.imagenUrl}
              maxLength={500}
              placeholder="/img/consulta.png"
              onChange={(e) => cambiar('imagenUrl', e.target.value)}
            />

            <label className="admin-novedad-check">
              <input
                type="checkbox"
                checked={editando.datos.activa}
                onChange={(e) => cambiar('activa', e.target.checked)}
              />{' '}
              Visible en el sitio
            </label>

            {errorForm && (
              <p className="admin-aviso admin-aviso--error" role="alert">
                {errorForm}
              </p>
            )}

            <div className="admin-mensaje-acciones">
              <Boton type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </Boton>
              <Boton variante="limpiar" onClick={() => setEditando(null)}>
                Cancelar
              </Boton>
            </div>
          </form>
        )}
      </Modal>

      <ModalConfirmacion
        abierto={aEliminar !== null}
        titulo="Eliminar novedad"
        mensaje={`¿Eliminar "${aEliminar?.titulo ?? ''}"? Esta acción no se puede deshacer.`}
        onConfirmar={() => void confirmarEliminacion()}
        onCancelar={() => setAEliminar(null)}
      />
    </>
  )
}
