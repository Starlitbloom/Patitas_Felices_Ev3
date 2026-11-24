/* =========================================================
   Prueba P07 — Detalle de una mascota
   Archivo probado: src/paginas/DetalleMascotaPage.tsx
   (muestra la ficha de la mascota y un mensaje si no existe)
   EP3: la ficha viene de mascota-service (simulado): Rocky tiene el id 1.
   Se inicia sesión como Maria Calfileo, dueña de Rocky.
========================================================= */

// Herramientas de Vitest: beforeEach (se repite antes de cada prueba), expect (comprobar) y test (definir una prueba)
import { beforeEach, expect, test } from 'vitest'
// screen: sirve para buscar cosas en la pantalla simulada
import { screen } from '@testing-library/react'
// Route y Routes: definen la dirección de la página (/mascotas/:id)
import { Route, Routes } from 'react-router-dom'
// dibuja la página con enrutador y sesión, como en la app real
import { renderConApp } from './utils'
// simularBackend: responde como los microservicios; ID_MASCOTA: id del backend de cada mascota de ejemplo
// iniciarSesionDePrueba: deja una sesión iniciada (simula que alguien hizo login)
import { ID_MASCOTA, iniciarSesionDePrueba, simularBackend } from './backendSimulado'
// La página que se va a probar
import DetalleMascotaPage from '../paginas/DetalleMascotaPage'

// Esto se ejecuta antes de cada prueba, para partir siempre con los mismos datos
beforeEach(() => {
  localStorage.clear()
  simularBackend() // mascota-service e historial-service simulados
  iniciarSesionDePrueba('admin-maria') // inicia sesión como Maria, la dueña
})

/* La página lee el id de la dirección (/mascotas/:id), por eso se prueba dentro de una ruta */
// Función ayudante: dibuja el detalle de la mascota con el id que se le pase
const mostrarDetalle = (id: string) =>
  renderConApp(
    // Define la ruta /mascotas/:id y le asigna la página de detalle
    <Routes>
      <Route path="/mascotas/:id" element={<DetalleMascotaPage />} />
    </Routes>,
    // Dirección inicial, por ejemplo /mascotas/1
    `/mascotas/${id}`,
  )

// Definición de la prueba: el texto es el nombre que aparecerá en el informe
test('P07 - READ: el detalle muestra la ficha de la mascota y avisa si no existe', async () => {
  // Una mascota que existe: se ve su nombre
  // Dibuja el detalle de Rocky; unmount sirve para quitarlo de la pantalla después
  const { unmount } = mostrarDetalle(String(ID_MASCOTA.rocky))
  // El título principal de la página debe ser "Rocky" (findBy espera la respuesta del backend)
  expect(await screen.findByRole('heading', { level: 1, name: 'Rocky' })).toBeInTheDocument()
  // El mensaje de error no debe aparecer (queryByText devuelve null si no lo encuentra)
  expect(screen.queryByText('Mascota no encontrada')).toBe(null)
  // Quita la página de Rocky para dibujar la siguiente sin mezclarlas
  unmount()

  // Una que no existe: aparece el mensaje de error
  // Dibuja el detalle de un id que no existe
  mostrarDetalle('no-existe')
  // Ahora sí debe aparecer el mensaje de error
  expect(await screen.findByText('Mascota no encontrada')).toBeInTheDocument()
})