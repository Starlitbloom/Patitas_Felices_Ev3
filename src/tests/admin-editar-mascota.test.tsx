/* =========================================================
   Prueba P08 — UPDATE en el panel de mascotas 
   Archivo probado: src/paginas/admin/MascotasPage.tsx
   (formulario de edición + guardado en mascota-service)
   EP3: el backend se simula con backendSimulado.ts, que parte con
   las 6 mascotas iniciales (src/data/mascotasIniciales.ts).
========================================================= */

// Herramientas de Vitest: beforeEach (se repite antes de cada prueba), expect (comprobar) y test (definir una prueba)
import { beforeEach, expect, test } from 'vitest'
// fireEvent: simula clics y escritura; screen: busca cosas en la pantalla; within: busca solo dentro de un elemento
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
// dibuja la página con enrutador y sesión, como en la app real
import { renderConApp } from './utils'
// simularBackend: responde como los microservicios y deja ver los datos guardados
// iniciarSesionDePrueba: sesión de la administradora (el panel exige rol de personal)
import { iniciarSesionDePrueba, simularBackend } from './backendSimulado'
// La página del panel de administración que se va a probar
import MascotasPage from '../paginas/admin/MascotasPage'

// Esto se ejecuta antes de cada prueba, para partir siempre con los mismos datos
let backend: ReturnType<typeof simularBackend>
beforeEach(() => {
  localStorage.clear()
  backend = simularBackend() // mascota-service simulado con las 6 mascotas iniciales
  iniciarSesionDePrueba('admin-maria') // sesión de administradora
})

// Definición de la prueba: el texto es el nombre que aparecerá en el informe
test('P08 - UPDATE: editar la raza de una mascota actualiza la tabla y los datos guardados', async () => {
  // Datos de prueba
  const razaNueva = 'Labrador Dorado' // la raza que se va a escribir

  // Dibuja el panel en una pantalla simulada
  renderConApp(<MascotasPage />)
  // Espera a que lleguen las mascotas del backend (aparece el botón de editar de Rocky)
  await screen.findByRole('button', { name: 'Editar a Rocky' })
  // La página tiene 3 tablas (solicitudes, mascotas e historial): la de mascotas es la segunda
  const tabla = within(screen.getAllByRole('table')[1])
  // Antes de editar, esa raza no debe existir en la tabla (queryByText devuelve null si no la encuentra)
  expect(tabla.queryByText(razaNueva)).toBe(null)

  // Simula un clic en el botón "Editar" de Rocky
  fireEvent.click(screen.getByRole('button', { name: 'Editar a Rocky' }))
  // Simula escribir la raza nueva en el campo "Raza" del formulario
  fireEvent.change(screen.getByLabelText('Raza'), { target: { value: razaNueva } })
  // Simula un clic en el botón que guarda los cambios
  fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))

  // Después de guardar, la raza nueva debe verse en la tabla (findBy espera la respuesta del backend)
  expect(await tabla.findByText(razaNueva)).toBeInTheDocument()
  // Y también debe haber quedado guardada en mascota-service (Rocky es la mascota 1)
  await waitFor(() => expect(backend.mascotas.find((m) => m.id === 1)?.raza).toBe(razaNueva))
})