/* PÁGINA (contenedor) — Mis mensajes (nueva en EP3).
   Muestra los mensajes que el usuario envió desde /contacto con su sesión
   iniciada, y la respuesta de la clínica (GET /mensajes/mis-mensajes en
   contacto-service). A esta página lleva el aviso "Respondimos tu mensaje"
   de la campanita de notificaciones. */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { mensajeDeError } from '../services/api'
import { listarMisMensajes } from '../services/contactoService'
import { NOMBRE_ESTADO_MENSAJE, type MensajeContacto } from '../types/contacto'
import { ListaPerfil } from '../componentes/organismos/ListaPerfil'
import { Etiqueta } from '../componentes/atomos/Etiqueta'

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-CL') : '')

export default function MisMensajesPage() {
  const [mensajes, setMensajes] = useState<MensajeContacto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    listarMisMensajes()
      .then((m) => activo && setMensajes(m))
      .catch((e) => activo && setError(mensajeDeError(e)))
    return () => {
      activo = false
    }
  }, [])

  const items = (mensajes ?? []).map((m) => ({
    id: String(m.id),
    titulo: `${fecha(m.fechaEnvio)} — ${m.asunto}`,
    detalle: NOMBRE_ESTADO_MENSAJE[m.estado],
    extra: (
      <div>
        <p className="mb-0">{m.mensaje}</p>
        {m.respuesta && (
          <div className="mis-mensajes-respuesta">
            <strong>Respuesta de la clínica ({fecha(m.fechaRespuesta)}):</strong>
            {m.respuesta}
          </div>
        )}
      </div>
    ),
  }))

  return (
    <main className="perfil-pagina">
      <div className="contenedor">
        <div className="formulario-cabecera">
          <Etiqueta>Contacto</Etiqueta>
          <h1>Mis mensajes</h1>
          <p>Las consultas que nos enviaste y nuestras respuestas.</p>
        </div>

        {error ? (
          <p className="perfil-lista-vacia" role="alert">
            {error}
          </p>
        ) : mensajes === null ? (
          <p className="perfil-lista-vacia">Cargando mensajes…</p>
        ) : (
          <ListaPerfil
            titulo="Mensajes enviados"
            icono="✉️"
            iconoItem="✉️"
            items={items}
            textoVacio="Aún no has enviado mensajes con tu sesión iniciada."
            enlace={{ to: '/contacto', texto: 'Escribirnos' }}
            ancha
          />
        )}

        <p className="perfil-cerrar-sesion-wrap">
          <Link to="/perfil" className="perfil-card-link">
            ← Volver a mi perfil
          </Link>
        </p>
      </div>
    </main>
  )
}
