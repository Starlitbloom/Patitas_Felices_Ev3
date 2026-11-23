// Archivo de preparación de las pruebas (lo carga Vitest antes de cada test).
// Agrega los "matchers" de jest-dom: toBeInTheDocument, toHaveClass, toBeDisabled, etc.
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// EP3: por defecto no hay backend (como si los microservicios estuvieran apagados).
// Las pruebas que necesitan respuestas llaman a simularBackend() (tests/backendSimulado.ts).
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Sin backend en las pruebas'))))
})

afterEach(() => {
  cleanup() // desmonta lo renderizado
  localStorage.clear() // cada prueba parte con el almacenamiento vacío
  vi.unstubAllGlobals()
})

// jsdom no implementa window.scrollTo (lo usa PlantillaPublica al cambiar de página):
// se reemplaza por una función simulada (mock) que no hace nada.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
