
/* =========================================================
   PATITAS FELICES - EVALUACIÓN 3

   MOLÉCULA: TARJETA DE VETERINARIO

   Muestra la información de cada integrante
   del equipo veterinario:

   - Fotografía del profesional.
   - Nombre y título.
   - Área de atención.
   - Años de experiencia.
   - Especies atendidas.
   - Botón para ver el perfil.

   Se conserva el diseño original.

   MEJORA:
   Si la fotografía registrada en MySQL no
   existe o no carga, se muestra una imagen
   de respaldo disponible en public/img.
========================================================= */

import type { Veterinario } from '../../types/veterinario'

import { EnlaceBoton } from '../atomos/EnlaceBoton'

export interface TarjetaVeterinarioProps {
  veterinario: Veterinario
}

/**
 * Tarjeta visual de un integrante del equipo.
 *
 * Los datos llegan desde el componente padre
 * mediante propiedades tipadas de TypeScript.
 */
export function TarjetaVeterinario({
  veterinario,
}: TarjetaVeterinarioProps) {

  const {
    id,
    nombre,
    titulo,
    area,
    especies,
    experiencia,
    imagen,
  } = veterinario

  return (

    <article className="equipo-tarjeta h-100">

      {/* Fotografía del profesional */}

      <img
        src={imagen || '/img/equipo.png'}
        alt={`Fotografía de ${nombre}`}
        className="equipo-tarjeta-imagen"

        // Si la imagen original no existe,
        // utilizar la imagen de respaldo.
        onError={(evento) => {

          const imagenActual = evento.currentTarget

          // Evitar un ciclo infinito si también
          // falla la imagen de respaldo.
          if (
            !imagenActual.src.endsWith(
              '/img/equipo.png'
            )
          ) {
            imagenActual.src = '/img/equipo.png'
          }

        }}
      />

      {/* Información del veterinario */}

      <div className="equipo-tarjeta-cuerpo">

        <span className="seccion-etiqueta">
          {titulo}
        </span>

        <h3>{nombre}</h3>

        <p className="equipo-tarjeta-dato">
          {area}
        </p>

        <p className="equipo-tarjeta-dato">
          {experiencia} años de experiencia
        </p>

        {/* Especies que atiende */}

        {especies.length > 0 && (

          <ul
            className="equipo-especies"
            aria-label={`Especies que atiende ${nombre}`}
          >

            {especies.map((especie) => (

              <li key={especie}>
                {especie}
              </li>

            ))}

          </ul>

        )}

        {/* Botón original para consultar el perfil */}

        <div className="mt-auto pt-2">

          <EnlaceBoton to={`/equipo/${id}`}>
            Ver perfil
          </EnlaceBoton>

        </div>

      </div>

    </article>

  )
}
