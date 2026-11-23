/* =========================================================
   Pruebas P07–P11 — Autenticación con JWT (EP3)
   Usan el backend simulado (tests/backendSimulado.ts), que
   responde como auth-service.
   - P07: login correcto guarda el token y lleva al panel
   - P08: login con contraseña incorrecta marca el campo
   - P09: al recargar, la sesión se restaura y el token vencido se renueva solo
   - P10: si el token no se puede renovar, se cierra la sesión y va a /login
   - P11: un cliente no puede entrar a una ruta de administrador
========================================================= */
import { beforeEach, expect, test } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { RutaProtegida } from '../routes/RutaProtegida'
import LoginPage from '../paginas/LoginPage'
import { CLAVES_TOKEN, ApiError, pedir } from '../services/api'
import { iniciarSesionDePrueba, simularBackend } from './backendSimulado'
import type { Rol } from '../types/usuario'

let backend: ReturnType<typeof simularBackend>

beforeEach(() => {
  backend = simularBackend()
})

/** App mínima: login, inicio, una página privada y una solo para admin. */
function renderApp(rutaInicial: string, roles?: Rol[]) {
  return render(
    <MemoryRouter initialEntries={[rutaInicial]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<p>Página de inicio</p>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<RutaProtegida roles={['admin', 'recepcionista']}><p>Panel de la clínica</p></RutaProtegida>} />
          <Route path="/privada" element={<RutaProtegida roles={roles}><p>Contenido privado</p></RutaProtegida>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

const iniciar = (correo: string, password: string) => {
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: correo } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: /Iniciar sesión/ }))
}

test('P07 - LOGIN: credenciales correctas guardan el JWT y llevan al panel según el rol', async () => {
  renderApp('/login')
  iniciar('ma.calfileo@duoc.cl', '1234')

  expect(await screen.findByText('Panel de la clínica')).toBeInTheDocument()
  expect(localStorage.getItem(CLAVES_TOKEN.token)).toBe('token-1')
  expect(localStorage.getItem(CLAVES_TOKEN.refresh)).toBe('refresh-1')
  // La contraseña nunca se guarda en el navegador
  expect(localStorage.getItem('patitasFelices_sesion')).not.toContain('1234')
})

test('P08 - LOGIN: contraseña incorrecta muestra el error del backend junto al campo', async () => {
  renderApp('/login')
  iniciar('ma.calfileo@duoc.cl', 'mala1')

  expect(await screen.findByText('Contraseña incorrecta.')).toBeInTheDocument()
  expect(localStorage.getItem(CLAVES_TOKEN.token)).toBe(null)
})

test('P09 - SESIÓN: al recargar se restaura la sesión y el token vencido se renueva automáticamente', async () => {
  iniciarSesionDePrueba('cli-001') // Camila: token-4 / refresh-4
  backend.vencerToken('token-4') // el token de acceso ya expiró

  renderApp('/privada') // equivale a recargar la página estando en una ruta privada

  expect(await screen.findByText('Contenido privado')).toBeInTheDocument()
  await waitFor(() => expect(localStorage.getItem(CLAVES_TOKEN.token)).toBe('token-4-renovado'))
  // Orden: /auth/me (401) → /auth/refresh → /auth/me otra vez con el token nuevo
  const rutas = backend.llamadas.map((l) => l.ruta)
  expect(rutas).toEqual(['/auth/me', '/auth/refresh', '/auth/me'])
})

test('P10 - SESIÓN: si el token no se puede renovar, la sesión se cierra y redirige a /login', async () => {
  iniciarSesionDePrueba('cli-001')
  localStorage.setItem(CLAVES_TOKEN.token, 'token-falso')
  localStorage.setItem(CLAVES_TOKEN.refresh, 'refresh-falso')

  renderApp('/privada')

  expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
  expect(localStorage.getItem(CLAVES_TOKEN.token)).toBe(null)
  expect(localStorage.getItem('patitasFelices_sesion')).toBe(null)
})

test('P11 - ROLES: un cliente que intenta entrar al panel es enviado al inicio', async () => {
  iniciarSesionDePrueba('cli-001') // rol cliente

  renderApp('/admin')

  expect(await screen.findByText('Página de inicio')).toBeInTheDocument()
  expect(screen.queryByText('Panel de la clínica')).toBe(null)
})

test('P12 - API: si un microservicio está apagado, el error dice cuál revisar', async () => {
  // setupTests deja fetch sin backend (falla la conexión)
  backend.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

  await expect(pedir('reporte', '/reportes/dashboard')).rejects.toThrow(ApiError)
  backend.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  await expect(pedir('reporte', '/reportes/dashboard')).rejects.toThrow(/report-service \(puerto 8090\)/)
})
