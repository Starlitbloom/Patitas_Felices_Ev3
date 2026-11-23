/* P02 - Eliminar usuario con confirmación (EP3: contra auth-service) */

import { beforeEach, expect, test } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderConApp } from './utils'
import { iniciarSesionDePrueba, simularBackend } from './backendSimulado'
import UsuariosPage from '../paginas/admin/UsuariosPage'

let backend: ReturnType<typeof simularBackend>

beforeEach(() => {
  backend = simularBackend()
  iniciarSesionDePrueba('admin-maria')
})

test('P02 - DELETE: eliminar un usuario con confirmación lo quita de la tabla y del backend', async () => {
  const nombreCompleto = 'Benjamín Soto Pérez'
  const correo = 'be.soto@duoc.cl'

  renderConApp(<UsuariosPage />)

  // La tabla aparece cuando responde GET /usuarios
  expect(await screen.findByText(correo)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: `Eliminar a ${nombreCompleto}` }))

  const confirmacion = screen.getByRole('dialog', { name: 'Eliminar usuario' })
  fireEvent.click(within(confirmacion).getByRole('button', { name: 'Eliminar' }))

  // Desaparece de la tabla después de DELETE /usuarios/{id} y de volver a listar
  await waitFor(() => expect(screen.queryByText(correo)).toBe(null))
  expect(await screen.findByText(`Usuario Benjamín eliminado.`)).toBeInTheDocument()

  const idBenjamin = 5 // posición 5 en los datos de ejemplo (3 cuentas fijas + Camila + Benjamín)
  expect(backend.llamadas.some((l) => l.metodo === 'DELETE' && l.ruta === `/usuarios/${idBenjamin}`)).toBe(true)
  expect(backend.usuarios.some((u) => u.correo === correo)).toBe(false)
})
