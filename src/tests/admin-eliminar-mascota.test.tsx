/* =========================================================
   Prueba P09 — DELETE en el panel de mascotas
   Archivo probado: src/paginas/admin/MascotasPage.tsx
   (confirmación antes de eliminar + borrado en mascota-service)
   EP3: el backend se simula con backendSimulado.ts, que parte con
   las 6 mascotas iniciales (src/data/mascotasIniciales.ts).
========================================================= */

// Herramientas de Vitest: beforeEach (se repite antes de cada prueba), expect (comprobar) y test (definir una prueba)
import { beforeEach, expect, test } from 'vitest'
// fireEvent: simula clics; screen: busca cosas en la pantalla; within: busca solo dentro de un elemento
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
// dibuja la página con enrutador y sesión, como en la app real
import { renderConApp } from './utils'
// simularBackend: responde como los microservicios y deja ver los datos guardados
// iniciarSesionDePrueba: sesión de la administradora (solo ADMIN puede eliminar)
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

/* ¿Rocky (id 1) sigue guardado en mascota-service? */
const rockyGuardado = () => backend.mascotas.some((m) => m.id === 1)

// Definición de la prueba: el texto es el nombre que aparecerá en el informe
test('P09 - DELETE: eliminar una mascota con confirmación la quita de la tabla y de los datos', async () => {
  // Dibuja el panel en una pantalla simulada
  renderConApp(<MascotasPage />)
  // Espera a que lleguen las mascotas del backend
  await screen.findByRole('button', { name: 'Eliminar a Rocky' })
  // La página tiene 3 tablas (solicitudes, mascotas e historial): la de mascotas es la segunda
  const tabla = within(screen.getAllByRole('table')[1])
  // Antes de eliminar, Rocky debe estar en la tabla
  expect(tabla.getByText('Rocky')).toBeInTheDocument()

  // Simula un clic en el botón "Eliminar" de Rocky
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar a Rocky' }))
  // Debe abrirse una ventana que pide confirmar
  const confirmacion = screen.getByRole('dialog', { name: 'Eliminar mascota' })
  // Todavía no se borró nada: Rocky sigue guardado
  expect(rockyGuardado()).toBe(true)

  // Simula un clic en el botón "Eliminar" dentro de la ventana de confirmación
  fireEvent.click(within(confirmacion).getByRole('button', { name: 'Eliminar' }))

  // Después de confirmar, Rocky ya no debe estar en la tabla (waitFor espera la respuesta del backend)
  await waitFor(() => expect(tabla.queryByText('Rocky')).toBe(null))
  // Y tampoco en mascota-service
  expect(rockyGuardado()).toBe(false)
})