
/* =========================================================
   PATITAS FELICES - EVALUACIÓN 3
   PÁGINA: NUESTRO EQUIPO

   Ruta: /equipo

   Funcionalidades:
   1. Consultar veterinarios desde Spring Boot.
   2. Mostrar los profesionales guardados en MySQL.
   3. Filtrar por nombre, cargo y especie.
   4. Mostrar mensajes de carga y error.
   5. Permitir reintentar la conexión.

   Se conservan los componentes y estilos originales.
========================================================= */

import { useEffect, useState } from 'react'

import type {
  FiltrosEquipo as Filtros,
  Veterinario,
} from '../types/veterinario'

import {
  consultarVeterinariosApi,
  filtrarVeterinarios,
} from '../services/veterinariosService'

import { mensajeDeError } from '../services/api'

import { FiltrosEquipo } from '../componentes/organismos/FiltrosEquipo'
import { GrillaEquipo } from '../componentes/organismos/GrillaEquipo'
import { TituloSeccion } from '../componentes/moleculas/TituloSeccion'


/* =========================================================
   FILTROS INICIALES

   Al abrir la página no se aplica ningún filtro.
========================================================= */

const SIN_FILTROS: Filtros = {
  texto: '',
  cargo: '',
  especie: '',
}


/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */

export default function EquipoPage() {

  // Profesionales obtenidos desde MySQL.
  const [veterinarios, setVeterinarios] =
    useState<Veterinario[]>([])

  // Filtros originales de la página.
  const [filtros, setFiltros] =
    useState<Filtros>(SIN_FILTROS)

  // Indica si la consulta está en proceso.
  const [cargando, setCargando] = useState(true)

  // Mensaje de error de conexión.
  const [error, setError] =
    useState<string | null>(null)

  // Permite volver a solicitar los datos.
  const [reintento, setReintento] = useState(0)


  /* =====================================================
     CONSULTAR VETERINARIOS

     Se ejecuta al abrir la página.

     GET http://localhost:8085/api/veterinarios

     Los datos se obtienen desde Spring Boot y MySQL.
  ===================================================== */

  useEffect(() => {

    let activo = true

    async function cargarVeterinarios() {

      try {

        const datos =
          await consultarVeterinariosApi()

        if (!activo) return

        setVeterinarios(datos)
        setError(null)

      } catch (errorCapturado) {

        if (!activo) return

        setVeterinarios([])

        setError(
          mensajeDeError(errorCapturado)
        )

      } finally {

        if (activo) {
          setCargando(false)
        }
      }
    }

    void cargarVeterinarios()

    // Evita actualizar estados después de salir
    // de la página.
    return () => {
      activo = false
    }

  }, [reintento])


  /* =====================================================
     FILTRAR PROFESIONALES

     Se mantienen los filtros originales,
     pero ahora trabajan con datos de MySQL.
  ===================================================== */

  const visibles = filtrarVeterinarios(
    veterinarios,
    filtros
  )


  /* =====================================================
     REINTENTAR CONEXIÓN

     Permite recuperar los datos si el backend
     estaba apagado o no respondía.
  ===================================================== */

  function reintentarConsulta() {

    setCargando(true)
    setError(null)

    setReintento(
      (anterior) => anterior + 1
    )
  }


  /* =====================================================
     INTERFAZ VISUAL

     Conservamos:
     - Clases CSS originales.
     - Título de sección.
     - Filtros originales.
     - Contador de integrantes.
     - Grilla de tarjetas.
  ===================================================== */

  return (

    <main className="equipo-pagina">

      <div className="contenedor">

        <TituloSeccion
          etiqueta="Conoce a quienes cuidan a tu mascota"
          titulo="Nuestro equipo"
          descripcion="Filtra por cargo o por la especie de tu mascota para encontrar a quien puede atenderla."
        />


        {/* Mensaje mientras se consultan los datos */}

        {cargando && (

          <p
            className="equipo-resumen"
            role="status"
          >
            Cargando equipo veterinario...
          </p>

        )}


        {/* Error cuando no se puede conectar al backend */}

        {!cargando && error && (

          <div role="alert">

            <p className="equipo-vacio">
              {error}
            </p>

            <button
              type="button"
              className="equipo-limpiar"
              onClick={reintentarConsulta}
            >
              Reintentar conexión
            </button>

          </div>

        )}


        {/* Mostrar el equipo si la consulta fue correcta */}

        {!cargando && !error && (

          <>

            <FiltrosEquipo
              filtros={filtros}
              onCambio={setFiltros}
              onLimpiar={() => setFiltros(SIN_FILTROS)}
            />

            <p
              className="equipo-resumen"
              aria-live="polite"
            >
              {visibles.length}{' '}

              {visibles.length === 1
                ? 'integrante encontrado'
                : 'integrantes encontrados'}
            </p>

            <GrillaEquipo
              veterinarios={visibles}
            />

          </>

        )}

      </div>

    </main>
  )
}
