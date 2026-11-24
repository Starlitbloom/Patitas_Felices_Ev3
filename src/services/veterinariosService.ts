
/* =========================================================
   VETERINARIA PATITAS FELICES
   SERVICIO DE VETERINARIOS - EVALUACIÓN 3

   Este archivo permite:

   1. Consultar veterinarios desde Spring Boot y MySQL.
   2. Consultar un veterinario por su ID.
   3. Adaptar los datos del backend al frontend.
   4. Mantener temporalmente los datos simulados.
   5. Filtrar veterinarios por nombre, cargo y especie.

   Microservicio:
   veterinario-service
   Puerto: 8085
========================================================= */

import { ApiError, pedir } from './api'

import { VETERINARIOS } from '../data/veterinarios'

import type {
  Cargo,
  Especie,
  FiltrosEquipo,
  Veterinario,
} from '../types/veterinario'


/* =========================================================
   1. TIPO DE DATOS RECIBIDOS DESDE EL BACKEND
========================================================= */

/**
 * Representa la respuesta de veterinario-service.
 *
 * El backend puede enviar cargo y especies como
 * cadenas de texto, mientras que React utiliza
 * tipos específicos para estos campos.
 */
type VeterinarioApi = Omit<
  Veterinario,
  'cargo' | 'especies' | 'imagen'
> & {
  cargo: string
  especies: string[]
  imagen: string | null
}


/* =========================================================
   2. NORMALIZAR CARGO
========================================================= */

/**
 * Convierte el cargo del backend a uno de los
 * valores utilizados por el frontend.
 */
function normalizarCargo(cargo: string): Cargo {

  const valor = (cargo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (valor.includes('tecnico')) {
    return 'Técnico veterinario'
  }

  if (valor.includes('recepcion')) {
    return 'Recepcionista'
  }

  return 'Médico veterinario'
}


/* =========================================================
   3. NORMALIZAR ESPECIES
========================================================= */

/**
 * Convierte las especies recibidas desde MySQL
 * a los valores definidos en types/veterinario.ts.
 */
function normalizarEspecie(
  especie: string
): Especie | null {

  const valor = especie
    .trim()
    .toLowerCase()

  if (valor.startsWith('perro')) {
    return 'Perros'
  }

  if (valor.startsWith('gato')) {
    return 'Gatos'
  }

  if (valor.startsWith('conejo')) {
    return 'Conejos'
  }

  if (valor.startsWith('ave')) {
    return 'Aves'
  }

  return null
}


/* =========================================================
   4. ADAPTAR RESPUESTA DEL BACKEND
========================================================= */

/**
 * Convierte un veterinario recibido desde Spring Boot
 * al formato que utilizan las tarjetas del frontend.
 *
 * Si el profesional no tiene fotografía registrada,
 * utiliza una imagen existente en la carpeta public.
 */
function adaptarVeterinario(
  datos: VeterinarioApi
): Veterinario {

  const especies: Especie[] = (
    Array.isArray(datos.especies)
      ? datos.especies
      : []
  )
    .map(normalizarEspecie)
    .filter(
      (especie): especie is Especie =>
        especie !== null
    )

  return {
    ...datos,

    cargo: normalizarCargo(datos.cargo),

    especies,

    dias: Array.isArray(datos.dias)
      ? datos.dias
      : [],

    imagen: datos.imagen || '/img/equipo.png',
  }
}


/* =========================================================
   5. CONSULTAR TODOS LOS VETERINARIOS DESDE MYSQL
========================================================= */

/**
 * Realiza la petición:
 *
 * GET http://localhost:8085/api/veterinarios
 *
 * Este endpoint es público y no requiere JWT.
 *
 * @returns Lista de veterinarios registrados en MySQL.
 */
export async function consultarVeterinariosApi():
  Promise<Veterinario[]> {

  const respuesta = await pedir<VeterinarioApi[]>(
    'veterinario',
    '/veterinarios',
    {
      sinToken: true,
    }
  )

  return respuesta.map(adaptarVeterinario)
}


/* =========================================================
   6. CONSULTAR UN VETERINARIO POR ID DESDE MYSQL
========================================================= */

/**
 * Realiza la petición:
 *
 * GET http://localhost:8085/api/veterinarios/{id}
 *
 * Devuelve null cuando el veterinario no existe.
 */
export async function consultarVeterinarioApiPorId(
  id: number
): Promise<Veterinario | null> {

  try {

    const respuesta = await pedir<VeterinarioApi>(
      'veterinario',
      `/veterinarios/${id}`,
      {
        sinToken: true,
      }
    )

    return adaptarVeterinario(respuesta)

  } catch (error) {

    if (
      error instanceof ApiError &&
      error.status === 404
    ) {
      return null
    }

    throw error
  }
}


/* =========================================================
   7. FUNCIONES ORIGINALES DEL FRONTEND
========================================================= */

/**
 * Mantiene la función original que utiliza
 * los veterinarios simulados.
 *
 * La conservamos para evitar problemas en las
 * pantallas que todavía no conectamos a MySQL.
 */
export function listarVeterinarios(): Veterinario[] {

  return VETERINARIOS
}


/**
 * Busca un veterinario en los datos simulados.
 *
 * Esta función se mantiene temporalmente hasta
 * actualizar las páginas que dependen de ella.
 */
export function obtenerVeterinarioPorId(
  id: number
): Veterinario | null {

  return VETERINARIOS.find(
    (veterinario) => veterinario.id === id
  ) ?? null
}


/* =========================================================
   8. FILTRAR VETERINARIOS
========================================================= */

/**
 * Filtra una lista de profesionales por:
 *
 * - Nombre.
 * - Cargo.
 * - Especies atendidas.
 *
 * Puede utilizarse tanto con datos simulados
 * como con los datos obtenidos desde MySQL.
 */
export function filtrarVeterinarios(
  lista: Veterinario[],
  filtros: FiltrosEquipo
): Veterinario[] {

  const texto = filtros.texto
    .trim()
    .toLowerCase()

  return lista.filter(
    (veterinario) => (

      (
        !texto ||
        veterinario.nombre
          .toLowerCase()
          .includes(texto)
      )

      &&

      (
        !filtros.cargo ||
        veterinario.cargo === filtros.cargo
      )

      &&

      (
        !filtros.especie ||
        veterinario.especies.includes(
          filtros.especie
        )
      )

    )
  )
}
