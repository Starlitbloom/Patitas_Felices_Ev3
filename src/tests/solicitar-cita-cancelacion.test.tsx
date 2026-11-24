
/* P14 - Cancelar una cita y liberar el horario */

import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import {
  actualizarCita,
  crearCita,
  horasOcupadas,
  listarCitas,
  reemplazarCacheCitas
} from '../services/citasService'

import { datosCitaPrueba } from './datos-citas'

beforeEach(() => {
  localStorage.clear()
  reemplazarCacheCitas([])
})

afterEach(() => vi.unstubAllGlobals())

test('P14 - cancela una cita y libera el horario', async () => {

  const datos = datosCitaPrueba()
  const creada = crearCita(datos)

  expect(creada.ok).toBe(true)
  if (!creada.ok) return

  expect(
    horasOcupadas(
      datos.fecha,
      undefined,
      1,
      datos.servicio
    )
  ).toContain('10:00')

  // cita-service responde la cita con el nuevo estado (PATCH /citas/{id}/estado)
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify({ ...creada.dato, estado: 'Cancelada' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  ))

  const cancelada = await actualizarCita(creada.dato.id, {
    estado: 'Cancelada'
  })

  expect(cancelada.ok).toBe(true)

  expect(
    horasOcupadas(
      datos.fecha,
      undefined,
      1,
      datos.servicio
    )
  ).not.toContain('10:00')

  const nuevaReserva = crearCita(
    datosCitaPrueba({
      mascota: 'Luna'
    })
  )

  expect(nuevaReserva.ok).toBe(true)
  expect(listarCitas()).toHaveLength(2)
})
