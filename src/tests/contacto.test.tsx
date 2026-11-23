/* =========================================================
   Prueba P13 — Formulario de contacto conectado a contacto-service (EP3)
   - Sin sesión: el mensaje se envía (POST /mensajes) sin token.
   - Con sesión: nombre y correo se completan solos, se envía el token
     y el mensaje queda asociado a la cuenta ("Mis mensajes").
========================================================= */
import { beforeEach, expect, test } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderConApp } from './utils'
import { iniciarSesionDePrueba, simularBackend } from './backendSimulado'
import FormularioContacto from '../componentes/organismos/FormularioContacto'

let backend: ReturnType<typeof simularBackend>

beforeEach(() => {
  backend = simularBackend()
})

const escribir = (etiqueta: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } })

function completarResto() {
  escribir('Teléfono *', '+56 9 1234 5678')
  escribir('Asunto *', 'Información sobre citas')
  escribir('Mensaje *', '¿Atienden conejos los sábados?')
  fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/ }))
}

test('P13 - CONTACTO: un visitante envía el formulario y se guarda en contacto-service', async () => {
  renderConApp(<FormularioContacto />)
  escribir('Nombre completo *', 'Pedro Muñoz')
  escribir('Correo electrónico *', 'pedro.munoz@gmail.com')
  completarResto()

  expect(await screen.findByText(/Tu mensaje fue enviado correctamente/)).toBeInTheDocument()
  const envio = backend.llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/mensajes')
  expect(envio?.token).toBe(null) // visitante sin sesión
  expect(envio?.cuerpo).toMatchObject({ nombre: 'Pedro Muñoz', telefono: '+56 9 1234 5678' })
})

test('P13b - CONTACTO: con sesión iniciada el mensaje queda asociado a la cuenta', async () => {
  iniciarSesionDePrueba('cli-001') // Camila Rojas

  renderConApp(<FormularioContacto />)
  // Nombre y correo vienen de la sesión
  expect(screen.getByLabelText('Correo electrónico *')).toHaveValue('camila.rojas@gmail.com')
  completarResto()

  expect(await screen.findByRole('link', { name: 'Mis mensajes' })).toBeInTheDocument()
  expect(backend.mensajes[0]).toMatchObject({ correoUsuario: 'camila.rojas@gmail.com', estado: 'PENDIENTE' })
})
