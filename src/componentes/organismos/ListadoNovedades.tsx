
/* =========================================================
    NOVEDADES
    LISTADO DE NOVEDADES

   Contiene:
   - Artículo destacado.
   - Filtro por categoría.
   - Tarjetas reutilizables.
   - Mensaje cuando no existen resultados.

   Utilizamos useState para controlar el filtro.
========================================================= */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Novedad } from '../../data/contenidoNovedades'
import { listarNovedades } from '../../services/novedadesService'
import { mensajeDeError } from '../../services/api'
import { TarjetaNovedad } from '../moleculas/TarjetaNovedad'
import { TituloSeccion } from '../moleculas/TituloSeccion'

// Categorías disponibles.
const categorias = [
  'Todas',
  'Salud',
  'Prevención',
  'Bienestar',
  'Consejos'
]

export default function ListadoNovedades() {

  // Estado del filtro seleccionado.
  const [categoria, setCategoria] = useState('Todas')

  // EP3: las novedades vienen de novedad-service (MySQL)
  const [novedades, setNovedades] = useState<Novedad[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    listarNovedades()
      .then((lista) => {
        if (activo) setNovedades(lista)
      })
      .catch((e: unknown) => {
        if (activo) setError(mensajeDeError(e))
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [])

  // El artículo destacado es la publicación más reciente.
  const destacada = novedades.at(0)

  /* =========================================================
      FILTRO DE NOVEDADES
     - Todas: muestra las demás publicaciones (la más reciente ya está destacada).
     - Una categoría: muestra todas las publicaciones de esa categoría.
  ========================================================= */
  const publicaciones = novedades.filter((novedad) =>
    categoria === 'Todas'
      ? novedad.id !== destacada?.id
      : novedad.categoria === categoria
  )

  return (
    <>
      {/* =========================================
          ARTÍCULO DESTACADO
      ========================================= */}

      {destacada && (
        <section className="seccion-destacada">
          <div className="contenedor">

            <TituloSeccion
              etiqueta="Destacado"
              titulo="Lo más reciente"
              descripcion="Información importante para cuidar la salud y bienestar de tu compañero."
            />

            <article className="novedad-destacada nueva-destacada">

              {/* Imagen principal */}
              <div className="destacada-imagen nueva-imagen">
                <img
                  src={destacada.imagen}
                  alt={destacada.alt}
                />
              </div>

              {/* Información */}
              <div className="destacada-info nueva-info">
                <span className="categoria-texto">
                  {destacada.categoria}
                </span>

                <p className="fecha">
                  {destacada.fecha}
                </p>

                <h2>{destacada.titulo}</h2>

                <p>{destacada.descripcion}</p>

                <div className="destacada-beneficios">
                  <span>♡ Prevención</span>
                  <span>🐾 Cuidado responsable</span>
                </div>

                <Link
                  className="boton-leer"
                  to={`/detalle-novedad?articulo=${destacada.id}`}
                >
                  Leer artículo →
                </Link>
              </div>

            </article>
          </div>
        </section>
      )}

      {/* =========================================
          MÁS NOVEDADES
      ========================================= */}

      <section className="seccion-novedades">
        <div className="contenedor">

          <TituloSeccion
            etiqueta="Consejos para tu compañero"
            titulo="Más novedades"
            descripcion="Pequeños consejos que pueden hacer una gran diferencia en el bienestar de tu mascota."
          />

          {/* Filtros con useState */}
          <div
            className="d-flex flex-wrap gap-2 mb-4"
            role="group"
            aria-label="Filtrar novedades por categoría"
          >
            {categorias.map((opcion) => (
              <button
                key={opcion}
                type="button"
                className={`btn ${
                  categoria === opcion
                    ? 'btn-primary'
                    : 'btn-outline-primary'
                }`}
                aria-pressed={categoria === opcion}
                onClick={() => setCategoria(opcion)}
              >
                {opcion}
              </button>
            ))}
          </div>

          {/* Tarjetas filtradas */}
          {cargando ? (
            <p role="status">Cargando novedades…</p>
          ) : error ? (
            <p role="alert">⚠️ {error}</p>
          ) : publicaciones.length > 0 ? (
            <div className="grid-novedades">
              {publicaciones.map((novedad) => (
                <TarjetaNovedad
                  key={novedad.id}
                  novedad={novedad}
                />
              ))}
            </div>
          ) : (
            <p role="status">
              No hay otras novedades disponibles
              en esta categoría.
            </p>
          )}

        </div>
      </section>
    </>
  )
}
