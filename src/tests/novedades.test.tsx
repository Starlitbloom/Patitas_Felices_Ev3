/* =========================================================
   Prueba — Novedades conectadas a novedad-service
   Se simula la respuesta del backend y se verifica que:
   1. La publicación más reciente aparece como destacada.
   2. El filtro por categoría muestra solo esa categoría.
========================================================= */
import { expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ListadoNovedades from '../componentes/organismos/ListadoNovedades'
import type { Novedad } from '../data/contenidoNovedades'

const NOVEDADES_API: Novedad[] = [
  { id: '3', categoria: 'Salud', fecha: '10 octubre 2026', titulo: 'Campaña de vacunación', descripcion: 'Vacunas al día.', imagen: '/img/a.png', alt: 'a' },
  { id: '2', categoria: 'Bienestar', fecha: '01 octubre 2026', titulo: 'Paseos diarios', descripcion: 'Actividad física.', imagen: '/img/b.png', alt: 'b' },
  { id: '1', categoria: 'Consejos', fecha: '20 septiembre 2026', titulo: 'Primera consulta', descripcion: 'Qué llevar.', imagen: '/img/c.png', alt: 'c' },
]

vi.mock('../services/novedadesService', () => ({
  listarNovedades: vi.fn(async () => NOVEDADES_API),
}))

test('NOVEDADES: muestra la más reciente como destacada y filtra por categoría', async () => {
  render(
    <MemoryRouter>
      <ListadoNovedades />
    </MemoryRouter>
  )

  // 1. La más reciente queda destacada y las demás en la lista
  expect(await screen.findByRole('heading', { level: 2, name: 'Campaña de vacunación' })).toBeInTheDocument()
  expect(screen.getByText('Paseos diarios')).toBeInTheDocument()
  expect(screen.getByText('Primera consulta')).toBeInTheDocument()

  // 2. Filtro por categoría
  fireEvent.click(screen.getByRole('button', { name: 'Bienestar' }))
  expect(screen.getByText('Paseos diarios')).toBeInTheDocument()
  expect(screen.queryByText('Primera consulta')).toBe(null)
})
