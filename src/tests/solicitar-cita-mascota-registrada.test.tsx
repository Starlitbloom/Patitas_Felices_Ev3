
/* P15 - Evitar fichas duplicadas de mascotas
   EP3: la mascota se guarda en mascota-service (simulado con backendSimulado.ts).
   Se inicia sesión como una clienta (Camila), dueña de la mascota nueva. */

import { beforeEach, expect, test } from 'vitest'

import {
  registrarMascotaDesdeCita
} from '../services/registroMascotaCitaService'

import {
  listarMascotasPorDueno
} from '../services/mascotasService'

import { iniciarSesionDePrueba, simularBackend } from './backendSimulado'

const CORREO_CLIENTA = 'camila.rojas@gmail.com'

beforeEach(() => {
  localStorage.clear()
  simularBackend() // mascota-service simulado
  iniciarSesionDePrueba('cli-001') // Camila (rol cliente)
})

test('P15 - evita duplicar la ficha de una mascota registrada', async () => {

  const datos = {
    nombre: 'Oso',
    especie: 'Perro' as const,
    edad: '3 años',
    dueño: 'Camila Rojas',
    correoDueño: CORREO_CLIENTA
  }

  /* Primera cita: se crea la ficha en el backend */
  const primera = await registrarMascotaDesdeCita(datos)

  /* Segunda cita con el mismo nombre (escrito distinto): no se crea otra ficha */
  const segunda = await registrarMascotaDesdeCita({
    ...datos,
    nombre: '  OSO ',
    correoDueño: CORREO_CLIENTA.toUpperCase()
  })

  expect(segunda.id).toBe(primera.id)
  expect(primera.completo).toBe(false)

  expect(
    await listarMascotasPorDueno(CORREO_CLIENTA)
  ).toHaveLength(1)
})
