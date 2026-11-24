/* ORGANISMO — Adelanto de novedades con enlace a la página completa.
   EP3: muestra las 2 publicaciones más recientes de novedad-service;
   si el servicio no responde, se usan los textos fijos de la portada. */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NOVEDADES_DESTACADAS } from '../../data/contenidoInicio'
import { listarNovedades } from '../../services/novedadesService'
import { Etiqueta } from '../atomos/Etiqueta'

const ICONO_CATEGORIA: Record<string, string> = {
  Salud: '💉',
  Prevención: '🩺',
  Bienestar: '🥕',
  Consejos: '💡',
}

interface MiniNovedad {
  icono: string
  titulo: string
  fecha: string
  enlace: string
}

const RESPALDO: MiniNovedad[] = NOVEDADES_DESTACADAS.map((n) => ({ ...n, enlace: '/novedades' }))

const TEMAS = ['Salud', 'Bienestar', 'Prevención', 'Consejos']

export function SeccionNovedades() {
  const [ultimas, setUltimas] = useState<MiniNovedad[]>(RESPALDO)

  useEffect(() => {
    let activo = true
    listarNovedades()
      .then((lista) => {
        if (!activo || lista.length === 0) return
        setUltimas(
          lista.slice(0, 2).map((n) => ({
            icono: ICONO_CATEGORIA[n.categoria] ?? '🐾',
            titulo: n.titulo,
            fecha: n.fecha,
            enlace: `/detalle-novedad?articulo=${n.id}`,
          }))
        )
      })
      .catch(() => {
        // Sin novedad-service se mantienen los textos de respaldo
      })
    return () => {
      activo = false
    }
  }, [])

  return (
    <section className="quienes-somos">
      <div className="quienes-contenido">
        <div className="quienes-texto">
          <Etiqueta>Al día con tu mascota</Etiqueta>
          <h2>Últimas novedades</h2>
          <p>Campañas de vacunación, consejos de cuidado y novedades de la clínica para que siempre estés informado.</p>
          <div className="quienes-destacados">
            {TEMAS.map((t) => (
              <span key={t} className="destacado">
                ♡ {t}
              </span>
            ))}
          </div>
          <div className="quienes-mini-lista">
            {ultimas.map((n) => (
              <Link key={n.titulo} to={n.enlace} className="quienes-mini-item">
                <span className="quienes-mini-icono">{n.icono}</span>
                <div className="quienes-mini-texto">
                  <h4>{n.titulo}</h4>
                  <span>{n.fecha}</span>
                </div>
                <span className="quienes-mini-flecha">→</span>
              </Link>
            ))}
          </div>
          <div className="hero-botones mt-4">
            <Link to="/novedades" className="boton-principal">
              Ver todas las novedades <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className="quienes-imagenes">
          <div className="quienes-decoracion decoracion-qs-rosa" />
          <div className="quienes-decoracion decoracion-qs-celeste" />
          <div className="carrusel-nosotros">
            <img src="/img/atencion-perrito.jfif" alt="Veterinaria atendiendo a un perro" className="imagen-nosotros imagen-nosotros-1" />
            <img src="/img/equipo.png" alt="Equipo veterinario junto a un perro" className="imagen-nosotros imagen-nosotros-2" />
          </div>
          <div className="quienes-badge">
            <span>🐾</span> Actualizado cada semana
          </div>
        </div>
      </div>
    </section>
  )
}
