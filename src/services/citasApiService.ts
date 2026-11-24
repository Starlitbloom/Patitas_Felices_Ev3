/* =========================================================
   PATITAS FELICES - EVALUACIÓN 3

   SERVICIO DE CITAS CON MYSQL

   Microservicio: cita-service
   Puerto: 8086

   Funcionalidades:
   1. Registrar una cita.
   2. Consultar las citas del usuario.
   3. Consultar una cita por ID.
   4. Cancelar una cita.
   5. Actualizar una reserva.

   Todas las peticiones utilizan JWT mediante api.ts.
========================================================= */

import { pedir } from './api'

/* =========================================================
   1. ESTADOS DE LAS CITAS
========================================================= */

export type EstadoCitaApi =
  | 'Pendiente'
  | 'Confirmada'
  | 'Completada'
  | 'Cancelada'

/* =========================================================
   2. DATOS PARA CREAR UNA CITA
========================================================= */

export interface NuevaCitaApi {
  dueno: string
  propietario: string
  correo: string
  telefono: string

  mascota: string
  tipoMascota: string
  otraEspecie?: string | null
  edadMascota: number

  veterinarioId: number | null

  servicio: string
  fecha: string
  hora: string
  motivo: string

  duracionMinutos?: number
}

/* =========================================================
   3. CITA GUARDADA EN MYSQL
========================================================= */

export interface CitaApi extends NuevaCitaApi {
  id: number

  correoUsuario: string
  nombreUsuario: string | null

  veterinarioNombre: string | null
  profesionalPorConfirmar: boolean

  estado: EstadoCitaApi
  fechaRegistro: string

  duracionMinutos: number
}

/* =========================================================
   4. REGISTRAR UNA CITA

   POST /api/citas

   Spring Boot verifica el JWT, los datos,
   el veterinario y los horarios disponibles.
========================================================= */

export async function solicitarCitaApi(
  datos: NuevaCitaApi
): Promise<CitaApi> {

  return pedir<CitaApi>(
    'cita',
    '/citas',
    {
      metodo: 'POST',
      cuerpo: datos,
    }
  )
}

/* =========================================================
   5. CONSULTAR MIS CITAS

   GET /api/citas/mis-citas
========================================================= */

export async function consultarMisCitasApi():
  Promise<CitaApi[]> {

  return pedir<CitaApi[]>(
    'cita',
    '/citas/mis-citas'
  )
}

/* =========================================================
   6. CONSULTAR UNA CITA POR ID

   GET /api/citas/{id}
========================================================= */

export async function consultarCitaApiPorId(
  id: number
): Promise<CitaApi> {

  return pedir<CitaApi>(
    'cita',
    `/citas/${id}`
  )
}

/* =========================================================
   7. CANCELAR UNA CITA

   PATCH /api/citas/{id}/cancelar

   Cambia el estado a Cancelada sin eliminar
   el registro de MySQL.
========================================================= */

export async function cancelarCitaApi(
  id: number
): Promise<CitaApi> {

  return pedir<CitaApi>(
    'cita',
    `/citas/${id}/cancelar`,
    {
      metodo: 'PATCH',
    }
  )
}

/* =========================================================
   8. ACTUALIZAR UNA CITA

   PUT /api/citas/{id}
========================================================= */

export async function actualizarCitaApi(
  id: number,
  datos: NuevaCitaApi
): Promise<CitaApi> {

  return pedir<CitaApi>(
    'cita',
    `/citas/${id}`,
    {
      metodo: 'PUT',
      cuerpo: datos,
    }
  )
}
