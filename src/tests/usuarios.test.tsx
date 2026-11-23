/* =========================================================
   Prueba P01 — CREATE del módulo de usuarios (EP3: contra auth-service)

   Verifica que crearUsuario envíe el usuario nuevo a la API
   (POST /usuarios con el token del admin) y que después
   aparezca al listar (GET /usuarios).
========================================================= */
import { beforeEach, expect, test } from 'vitest'
import { crearUsuario, listarUsuarios } from '../services/usuariosService'
import { iniciarSesionDePrueba, simularBackend } from './backendSimulado'
import type { NuevoUsuario } from '../types/usuario'

let backend: ReturnType<typeof simularBackend>

beforeEach(() => {
  backend = simularBackend() // auth-service simulado con los 8 usuarios de ejemplo
  iniciarSesionDePrueba('admin-maria') // solo un ADMIN puede crear usuarios
})

test('P01 - CREATE: crearUsuario envía el usuario a auth-service y luego aparece en la lista', async () => {
  // Datos de prueba
  const usuarioNuevo: NuevoUsuario = {
    run: '20987654-K',
    nombre: 'Ignacia',
    apellidos: 'Pino',
    correo: 'ignacia.pino@gmail.com',
    password: 'hola1234',
    telefono: '',
    region: 'Valparaíso',
    comuna: 'Quilpué',
    direccion: 'Los Carrera 12',
    rol: 'cliente',
    activo: true,
  }

  const resultado = await crearUsuario(usuarioNuevo)

  expect(resultado.ok).toBe(true)
  // Se envió con el token del admin y con el rol en el formato del backend
  const llamada = backend.llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/usuarios')
  expect(llamada?.token).toBe('token-1')
  expect(llamada?.cuerpo).toMatchObject({ correo: 'ignacia.pino@gmail.com', rol: { nombre: 'CLIENTE' } })

  const usuarios = await listarUsuarios()
  expect(usuarios.length).toBe(9) // 8 iniciales + 1 nuevo
  expect(usuarios.some((u) => u.correo === 'ignacia.pino@gmail.com')).toBe(true)
})

test('P01b - CREATE: si el correo ya existe, devuelve el error del backend en el campo correo', async () => {
  const resultado = await crearUsuario({
    run: '12345678-5',
    nombre: 'Copia',
    apellidos: 'Repetida',
    correo: 'camila.rojas@gmail.com', // ya existe
    password: '1234',
    telefono: '',
    region: '',
    comuna: '',
    direccion: '',
    rol: 'cliente',
    activo: true,
  })

  expect(resultado).toEqual({ ok: false, campo: 'correo', mensaje: 'Ya existe una cuenta registrada con este correo.' })
})
