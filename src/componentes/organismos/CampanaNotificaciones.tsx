/* ORGANISMO — Campanita de notificaciones (nueva en EP3).
   - Muestra cuántos avisos sin leer tiene el usuario (se actualiza cada minuto).
   - Al abrirla lista los últimos avisos; al hacer clic en uno se marca como
     leído y lleva a la página del aviso (ej: "Mis mensajes").
   Datos: notificacion-service (puerto 8089). Si el servicio está apagado,
   la campanita se muestra sin número y con un aviso dentro. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mensajeDeError } from '../../services/api'
import { contarNoLeidas, listarMisNotificaciones, marcarLeida, marcarTodasLeidas } from '../../services/notificacionesService'
import { ICONO_NOTIFICACION, type Notificacion } from '../../types/notificacion'

const INTERVALO_MS = 60_000 // revisar avisos nuevos cada 1 minuto
const MAXIMO_EN_LISTA = 8

export interface CampanaNotificacionesProps {
  /** Colores: "publica" para el header del sitio, "admin" para el panel oscuro. */
  variante?: 'publica' | 'admin'
}

const haceCuanto = (iso: string) => {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  return new Date(iso).toLocaleDateString('es-CL')
}

export function CampanaNotificaciones({ variante = 'publica' }: CampanaNotificacionesProps) {
  const navigate = useNavigate()
  const contenedor = useRef<HTMLDivElement>(null)
  const [abierta, setAbierta] = useState(false)
  const [cantidad, setCantidad] = useState<number | null>(null)
  const [lista, setLista] = useState<Notificacion[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const actualizarContador = useCallback(async () => {
    try {
      setCantidad(await contarNoLeidas())
    } catch {
      setCantidad(null) // servicio apagado: sin número
    }
  }, [])

  const cargarLista = useCallback(async () => {
    try {
      setLista((await listarMisNotificaciones()).slice(0, MAXIMO_EN_LISTA))
      setError(null)
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }, [])

  // Contador al cargar y cada minuto
  useEffect(() => {
    let activo = true
    contarNoLeidas()
      .then((n) => activo && setCantidad(n))
      .catch(() => activo && setCantidad(null))
    const intervalo = window.setInterval(actualizarContador, INTERVALO_MS)
    return () => {
      activo = false
      window.clearInterval(intervalo)
    }
  }, [actualizarContador])

  // Cerrar con clic afuera o con Escape
  useEffect(() => {
    if (!abierta) return
    const alHacerClic = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierta(false)
    }
    const alPresionar = (e: KeyboardEvent) => e.key === 'Escape' && setAbierta(false)
    document.addEventListener('mousedown', alHacerClic)
    window.addEventListener('keydown', alPresionar)
    return () => {
      document.removeEventListener('mousedown', alHacerClic)
      window.removeEventListener('keydown', alPresionar)
    }
  }, [abierta])

  const alternar = () => {
    if (!abierta) cargarLista()
    setAbierta(!abierta)
  }

  const abrirAviso = async (n: Notificacion) => {
    setAbierta(false)
    if (!n.leida) {
      try {
        await marcarLeida(n.id)
      } catch {
        // si no se pudo marcar, igual se navega
      }
      actualizarContador()
    }
    if (n.enlace) navigate(n.enlace)
  }

  const leerTodas = async () => {
    try {
      await marcarTodasLeidas()
      await Promise.all([cargarLista(), actualizarContador()])
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }

  const etiqueta = cantidad ? `Notificaciones: ${cantidad} sin leer` : 'Notificaciones'

  return (
    <div className={`campana campana--${variante}`} ref={contenedor}>
      <button type="button" className="campana-boton" onClick={alternar} aria-label={etiqueta} aria-expanded={abierta} title={etiqueta}>
        <span aria-hidden="true">🔔</span>
        {!!cantidad && <span className="campana-contador">{cantidad > 9 ? '9+' : cantidad}</span>}
      </button>

      {abierta && (
        <div className="campana-panel" role="dialog" aria-label="Notificaciones">
          <div className="campana-panel-cabecera">
            <strong>Notificaciones</strong>
            {!!cantidad && (
              <button type="button" className="campana-leer-todas" onClick={leerTodas}>
                Marcar todas como leídas
              </button>
            )}
          </div>

          {error ? (
            <p className="campana-vacia" role="alert">
              {error}
            </p>
          ) : lista === null ? (
            <p className="campana-vacia">Cargando…</p>
          ) : lista.length === 0 ? (
            <p className="campana-vacia">No tienes notificaciones.</p>
          ) : (
            <ul className="campana-lista">
              {lista.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`campana-item ${n.leida ? '' : 'campana-item--nueva'}`.trim()}
                    onClick={() => abrirAviso(n)}
                  >
                    <span className="campana-item-icono" aria-hidden="true">
                      {ICONO_NOTIFICACION[n.tipo] ?? '🔔'}
                    </span>
                    <span className="campana-item-texto">
                      <strong>{n.titulo}</strong>
                      <span>{n.mensaje}</span>
                      <small>{haceCuanto(n.fechaCreacion)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
