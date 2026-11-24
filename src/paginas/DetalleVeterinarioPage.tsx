/* =========================================================
   PATITAS FELICES - EVALUACIÓN 3

   PÁGINA: PERFIL DEL VETERINARIO
   Ruta: /equipo/:id

   Funcionalidades:

   1. Obtener el ID del veterinario desde la URL.
   2. Consultar su información desde Spring Boot.
   3. Mostrar los datos almacenados en MySQL.
   4. Mostrar fotografía o imagen de respaldo.
   5. Informar errores de conexión.
   6. Mostrar el horario de atención del profesional.

   Se mantiene el diseño original de la Evaluación 2.

   Microservicio:
   veterinario-service - Puerto 8085

   Endpoint:
   GET /api/veterinarios/{id}
========================================================= */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import type { Veterinario } from '../types/veterinario'

import {
  consultarVeterinarioApiPorId,
} from '../services/veterinariosService'

import { mensajeDeError } from '../services/api'

import { Boton } from '../componentes/atomos/Boton'
import { EnlaceBoton } from '../componentes/atomos/EnlaceBoton'
import { Etiqueta } from '../componentes/atomos/Etiqueta'


/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */

export default function DetalleVeterinarioPage() {

  // Obtener el ID desde la dirección de la página.
  // Ejemplo: /equipo/2
  const { id } = useParams<{ id: string }>()

  // Datos del veterinario obtenidos desde MySQL.
  const [veterinario, setVeterinario] =
    useState<Veterinario | null>(null)

  // Indica si se está realizando la consulta.
  const [cargando, setCargando] = useState(true)

  // Guarda los posibles errores de conexión.
  const [error, setError] =
    useState<string | null>(null)

  // Permite volver a consultar el backend.
  const [reintento, setReintento] = useState(0)


  /* =====================================================
     1. CONSULTAR VETERINARIO DESDE MYSQL

     Se ejecuta al abrir la página o cambiar el ID.

     Ejemplo:
     GET http://localhost:8080/veterinario/api/v1/veterinarios/2
  ===================================================== */

  useEffect(() => {

    let activo = true

    async function cargarVeterinario() {

      setCargando(true)
      setError(null)
      setVeterinario(null)

      // Convertir el identificador recibido a número.
      const veterinarioId = Number(id)

      // Validar que el ID sea correcto.
      if (
        !Number.isSafeInteger(veterinarioId) ||
        veterinarioId <= 0
      ) {
        setCargando(false)
        return
      }

      try {

        // Consultar el registro mediante Spring Boot.
        const datos =
          await consultarVeterinarioApiPorId(
            veterinarioId
          )

        if (!activo) return

        // Guardar la información obtenida de MySQL.
        setVeterinario(datos)

      } catch (errorCapturado) {

        if (!activo) return

        // Mostrar un mensaje si falla la conexión.
        setError(
          mensajeDeError(errorCapturado)
        )

      } finally {

        if (activo) {
          setCargando(false)
        }
      }
    }

    void cargarVeterinario()

    // Evitar actualizar estados al salir de la página.
    return () => {
      activo = false
    }

  }, [id, reintento])


  /* =====================================================
     2. IR AL HORARIO DE ATENCIÓN

     Desplaza la página hasta la sección que muestra
     los días y horarios del profesional.
  ===================================================== */

  function irAHorario() {

    document
      .getElementById('agenda-titulo')
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
  }


  /* =====================================================
     3. PANTALLA DE CARGA
  ===================================================== */

  if (cargando) {

    return (
      <main className="equipo-pagina">
        <div className="contenedor text-center">

          <p role="status">
            Cargando perfil del veterinario...
          </p>

        </div>
      </main>
    )
  }


  /* =====================================================
     4. ERROR DE CONEXIÓN
  ===================================================== */

  if (error) {

    return (
      <main className="equipo-pagina">
        <div className="contenedor text-center">

          <h1>No se pudo cargar el perfil</h1>

          <p role="alert">{error}</p>

          <Boton
            onClick={() =>
              setReintento(anterior => anterior + 1)
            }
          >
            Reintentar conexión
          </Boton>

          <div className="mt-4">

            <EnlaceBoton
              to="/equipo"
              variante="secundario"
            >
              ← Volver al equipo
            </EnlaceBoton>

          </div>

        </div>
      </main>
    )
  }


  /* =====================================================
     5. VETERINARIO NO ENCONTRADO

     Se muestra cuando el backend responde HTTP 404
     o cuando el ID de la URL es inválido.
  ===================================================== */

  if (!veterinario) {

    return (
      <main className="equipo-pagina">
        <div className="contenedor text-center">

          <h1>Profesional no encontrado</h1>

          <p>
            No existe un integrante del equipo
            con el identificador "{id}".
          </p>

          <EnlaceBoton
            to="/equipo"
            variante="secundario"
          >
            ← Volver al equipo
          </EnlaceBoton>

        </div>
      </main>
    )
  }


  /* =====================================================
     6. INFORMACIÓN DEL VETERINARIO

     Estos datos provienen de veterinario-service
     y se encuentran almacenados en MySQL.
  ===================================================== */

  const {
    nombre,
    cargo,
    titulo,
    area,
    especies,
    experiencia,
    descripcion,
    dias,
    horario,
    imagen,
    correo,
  } = veterinario

  // Solamente los médicos atienden citas.
  const esMedico = cargo === 'Médico veterinario'


  /* =====================================================
     7. INTERFAZ DEL PERFIL

     Se conservan las clases CSS originales:
     - equipo-pagina
     - equipo-detalle
     - equipo-detalle-imagen
     - equipo-detalle-datos
     - agenda
  ===================================================== */

  return (

    <main className="equipo-pagina">

      <div className="contenedor">

        {/* Información principal */}

        <article className="equipo-detalle row g-4 align-items-center">

          {/* Fotografía del profesional */}

          <div className="col-12 col-md-5">

            <img
              src={imagen || '/img/equipo.png'}
              alt={`Imagen representativa de ${nombre}`}
              className="equipo-detalle-imagen"

              // Utilizar una imagen de respaldo
              // cuando la fotografía no existe.
              onError={(evento) => {

                const elemento = evento.currentTarget

                if (
                  !elemento.src.endsWith('/img/equipo.png')
                ) {
                  elemento.src = '/img/equipo.png'
                }

              }}
            />

          </div>


          {/* Datos del veterinario */}

          <div className="col-12 col-md-7">

            <Etiqueta>{titulo}</Etiqueta>

            <h1>{nombre}</h1>

            <p>{descripcion}</p>

            <ul className="equipo-detalle-datos">

              <li>
                <strong>Área:</strong> {area}
              </li>

              <li>
                <strong>Experiencia:</strong>{' '}
                {experiencia} años
              </li>

              {especies.length > 0 && (

                <li>

                  <strong>Atiende a:</strong>{' '}

                  {especies.join(', ')}

                </li>

              )}

              <li>

                <strong>Días:</strong>{' '}

                {dias.length > 0
                  ? dias.join(', ')
                  : 'No informados'}

              </li>

              <li>

                <strong>Horario:</strong>{' '}

                {horario} hrs

              </li>

              <li>

                <strong>Correo:</strong>{' '}

                {correo}

              </li>

            </ul>


            {/* Botones originales del perfil */}

            <div className="d-flex flex-wrap gap-3 mt-4">

              {esMedico && (

                <Boton onClick={irAHorario}>
                  Ver horario de atención
                </Boton>

              )}

              <EnlaceBoton
                to="/equipo"
                variante="secundario"
              >
                ← Volver al equipo
              </EnlaceBoton>

            </div>

          </div>

        </article>


        {/* =================================================
           8. HORARIOS DEL PROFESIONAL

           Los días y horas provienen de MySQL.

           Todavía no mostramos bloques disponibles
           porque la agenda de la EP2 consulta
           reservas locales del navegador.

           Más adelante conectaremos la disponibilidad
           real mediante cita-service.
        ================================================= */}

        {esMedico && (

          <section
            className="agenda"
            aria-labelledby="agenda-titulo"
          >

            <div className="agenda-cabecera">

              <div>

                <h2 id="agenda-titulo">
                  Horario de atención
                </h2>

                <p className="agenda-resumen">

                  {nombre} atiende los días{' '}

                  {dias.length > 0
                    ? dias.join(', ')
                    : 'pendientes de confirmar'}.

                </p>

                <p>
                  <strong>Horario:</strong>{' '}
                  {horario} hrs.
                </p>

                <p>

                  La disponibilidad de citas en línea
                  se está integrando con el sistema
                  de reservas de la clínica.

                </p>

              </div>

            </div>

          </section>

        )}

      </div>

    </main>

  )
}
