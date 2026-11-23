/* PÁGINA (contenedor) — Bandeja de mensajes de contacto (nueva en EP3).
   Admin y recepcionista revisan lo que llega desde el formulario de /contacto.
   Todo se guarda en contacto-service (puerto 8088):
     R → listar con filtro por estado        GET  /mensajes?estado=
     U → marcar leído / archivar              PUT  /mensajes/{id}/estado
     U → responder                            PUT  /mensajes/{id}/responder
         (contacto-service le avisa al usuario por WebClient → notificacion-service)
     D → eliminar (solo admin)                DELETE /mensajes/{id} */
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { mensajeDeError } from '../../services/api'
import {
  cambiarEstadoMensaje,
  eliminarMensaje,
  listarMensajes,
  responderMensaje,
} from '../../services/contactoService'
import { NOMBRE_ESTADO_MENSAJE, type EstadoMensaje, type MensajeContacto } from '../../types/contacto'
import { EncabezadoAdmin } from '../../componentes/organismos/EncabezadoAdmin'
import { Modal } from '../../componentes/organismos/Modal'
import { ModalConfirmacion } from '../../componentes/organismos/ModalConfirmacion'
import { Boton } from '../../componentes/atomos/Boton'

const FILTROS: { valor: EstadoMensaje | ''; texto: string }[] = [
  { valor: '', texto: 'Todos' },
  { valor: 'PENDIENTE', texto: 'Pendientes' },
  { valor: 'LEIDO', texto: 'Leídos' },
  { valor: 'RESPONDIDO', texto: 'Respondidos' },
  { valor: 'ARCHIVADO', texto: 'Archivados' },
]

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—')

function EstadoBadge({ estado }: { estado: EstadoMensaje }) {
  return <span className={`admin-badge admin-badge--${estado.toLowerCase()}`}>{NOMBRE_ESTADO_MENSAJE[estado]}</span>
}

export default function MensajesPage() {
  const { esAdmin } = useAuth()
  const [filtro, setFiltro] = useState<EstadoMensaje | ''>('')
  const [mensajes, setMensajes] = useState<MensajeContacto[]>([])
  const [cargando, setCargando] = useState(true)
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null)
  const [abierto, setAbierto] = useState<MensajeContacto | null>(null)
  const [respuesta, setRespuesta] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aEliminar, setAEliminar] = useState<MensajeContacto | null>(null)

  const recargar = useCallback(async () => {
    try {
      setMensajes(await listarMensajes(filtro || undefined))
    } catch (error) {
      setAviso({ texto: mensajeDeError(error), error: true })
    } finally {
      setCargando(false)
    }
  }, [filtro])

  // Se vuelve a pedir la bandeja cada vez que cambia el filtro
  useEffect(() => {
    let activo = true
    listarMensajes(filtro || undefined)
      .then((lista) => activo && setMensajes(lista))
      .catch((error) => activo && setAviso({ texto: mensajeDeError(error), error: true }))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [filtro])

  /** Ejecuta una acción sobre el mensaje abierto y refresca la bandeja. */
  const ejecutar = async (accion: () => Promise<MensajeContacto | void>, textoExito: string) => {
    setGuardando(true)
    try {
      const actualizado = await accion()
      setAviso({ texto: textoExito })
      setAbierto(actualizado ? actualizado : null)
      await recargar()
    } catch (error) {
      setAviso({ texto: mensajeDeError(error), error: true })
    } finally {
      setGuardando(false)
    }
  }

  const abrir = async (m: MensajeContacto) => {
    setRespuesta(m.respuesta ?? '')
    setAbierto(m)
    // Al abrir un mensaje pendiente, se marca como leído automáticamente
    if (m.estado === 'PENDIENTE') {
      try {
        setAbierto(await cambiarEstadoMensaje(m.id, 'LEIDO'))
        await recargar()
      } catch {
        // si falla, el mensaje igual se puede leer
      }
    }
  }

  const responder = () => {
    if (!abierto) return
    if (respuesta.trim().length < 5) {
      setAviso({ texto: 'La respuesta debe tener al menos 5 caracteres.', error: true })
      return
    }
    const destinatario = abierto.correoUsuario
      ? `Respuesta enviada. ${abierto.nombre} verá un aviso en su campanita 🔔.`
      : 'Respuesta guardada. Esta persona no tiene cuenta: contáctala a su correo o teléfono.'
    ejecutar(() => responderMensaje(abierto.id, respuesta.trim()), destinatario)
  }

  const confirmarEliminacion = () => {
    if (!aEliminar) return
    const m = aEliminar
    setAEliminar(null)
    ejecutar(() => eliminarMensaje(m.id), `Mensaje de ${m.nombre} eliminado.`)
  }

  return (
    <>
      <EncabezadoAdmin>Mensajes de contacto ✉️</EncabezadoAdmin>

      {aviso && (
        <div className={`admin-aviso ${aviso.error ? 'admin-aviso--error' : ''}`.trim()} role="status">
          {aviso.texto}
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}

      <div className="admin-filtros-estado" role="group" aria-label="Filtrar por estado">
        {FILTROS.map((f) => (
          <button
            key={f.texto}
            type="button"
            className={filtro === f.valor ? 'activo' : undefined}
            aria-pressed={filtro === f.valor}
            onClick={() => setFiltro(f.valor)}
          >
            {f.texto}
          </button>
        ))}
      </div>

      <section className="admin-tabla-seccion" aria-busy={cargando}>
        {cargando ? (
          <p className="admin-tabla-vacia">Cargando mensajes…</p>
        ) : mensajes.length === 0 ? (
          <p className="admin-tabla-vacia">No hay mensajes {filtro ? 'con este estado' : 'todavía'}.</p>
        ) : (
          <div className="admin-tabla-wrap table-responsive">
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nombre</th>
                  <th>Asunto</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {mensajes.map((m) => (
                  <tr key={m.id}>
                    <td>{fecha(m.fechaEnvio)}</td>
                    <td>
                      {m.nombre}
                      <br />
                      <small>{m.correo}</small>
                    </td>
                    <td>{m.asunto}</td>
                    <td>
                      <EstadoBadge estado={m.estado} />
                    </td>
                    <td>
                      <div className="admin-acciones-fila">
                      <Boton variante="ver" onClick={() => abrir(m)} aria-label={`Ver mensaje de ${m.nombre}`}>
                        Ver
                      </Boton>
                      {esAdmin && (
                        <Boton variante="eliminar" onClick={() => setAEliminar(m)} aria-label={`Eliminar mensaje de ${m.nombre}`}>
                          Eliminar
                        </Boton>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal abierto={abierto !== null} titulo={abierto ? `Mensaje de ${abierto.nombre}` : 'Mensaje'} onCerrar={() => setAbierto(null)} ancho>
        {abierto && (
          <>
            <p className="admin-mensaje-meta">
              <EstadoBadge estado={abierto.estado} /> · {abierto.asunto} · {fecha(abierto.fechaEnvio)}
            </p>
            <p className="admin-mensaje-meta">
              ✉ {abierto.correo} · ☎ {abierto.telefono}
              {abierto.correoUsuario ? ' · 👤 Tiene cuenta' : ' · Sin cuenta'}
            </p>
            <div className="admin-mensaje-texto">{abierto.mensaje}</div>

            {abierto.estado === 'RESPONDIDO' && abierto.respuesta ? (
              <>
                <h4 className="admin-modal-seccion">Respuesta enviada</h4>
                <div className="admin-mensaje-texto">{abierto.respuesta}</div>
                <p className="admin-mensaje-meta">
                  Por {abierto.respondidoPor} · {fecha(abierto.fechaRespuesta)}
                </p>
              </>
            ) : abierto.estado !== 'ARCHIVADO' ? (
              <div className="admin-mensaje-respuesta">
                <label htmlFor="respuesta-mensaje" className="admin-modal-seccion">
                  Responder
                </label>
                <textarea
                  id="respuesta-mensaje"
                  value={respuesta}
                  maxLength={1000}
                  onChange={(e) => setRespuesta(e.target.value)}
                  placeholder="Escribe la respuesta para esta persona…"
                />
              </div>
            ) : null}

            <div className="admin-mensaje-acciones">
              {abierto.estado !== 'RESPONDIDO' && abierto.estado !== 'ARCHIVADO' && (
                <Boton onClick={responder} disabled={guardando}>
                  Enviar respuesta
                </Boton>
              )}
              {abierto.estado !== 'ARCHIVADO' ? (
                <Boton
                  variante="limpiar"
                  disabled={guardando}
                  onClick={() => ejecutar(() => cambiarEstadoMensaje(abierto.id, 'ARCHIVADO'), 'Mensaje archivado.')}
                >
                  Archivar
                </Boton>
              ) : (
                <Boton
                  variante="limpiar"
                  disabled={guardando}
                  onClick={() => ejecutar(() => cambiarEstadoMensaje(abierto.id, 'LEIDO'), 'Mensaje restaurado a la bandeja.')}
                >
                  Desarchivar
                </Boton>
              )}
            </div>
          </>
        )}
      </Modal>

      <ModalConfirmacion
        abierto={aEliminar !== null}
        titulo="Eliminar mensaje"
        mensaje={`¿Eliminar el mensaje de ${aEliminar?.nombre ?? ''}? Esta acción no se puede deshacer.`}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setAEliminar(null)}
      />
    </>
  )
}
