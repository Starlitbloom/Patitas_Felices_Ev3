/* =========================================================
   Backend simulado para las pruebas (EP3).
   Reemplaza fetch por una función que responde como los
   microservicios reales: auth-service, contacto-service y
   notificacion-service. Así las pruebas recorren el código real
   (api.ts, servicios, contexto y páginas) sin levantar Spring Boot.

   Reglas que imita del backend:
   - token "token-<id>" y refreshToken "refresh-<id>"
   - 401 si falta el token o está en la lista de vencidos
   - 403 si el rol no tiene permiso (ej: un cliente pidiendo /usuarios)
   - errores con el formato { status, campo, mensaje }
========================================================= */
import { vi } from 'vitest'
import { CLIENTES_EJEMPLO, CUENTAS_FIJAS } from '../data/usuariosIniciales'
import type { Usuario, UsuarioApi } from '../types/usuario'
import { guardarTokens } from '../services/api'
import { guardarSesion } from '../services/sesionService'

interface Llamada {
  metodo: string
  ruta: string
  cuerpo: unknown
  token: string | null
}

/** Usuarios de ejemplo en el formato de auth-service (ids numéricos 1, 2, 3...). */
function usuariosIniciales(): (UsuarioApi & { password: string; idEjemplo: string })[] {
  return [...CUENTAS_FIJAS, ...CLIENTES_EJEMPLO].map((u, i) => ({
    id: i + 1,
    idEjemplo: u.id,
    run: u.run,
    nombre: u.nombre,
    apellidos: u.apellidos,
    correo: u.correo,
    password: u.password,
    telefono: u.telefono,
    region: u.region,
    comuna: u.comuna,
    direccion: u.direccion,
    activo: u.activo,
    avatar: null,
    rol: { nombre: u.rol.toUpperCase() },
    fechaRegistro: u.fechaRegistro,
  }))
}

const respuesta = (status: number, cuerpo?: unknown) =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const error = (status: number, campo: string | null, mensaje: string) => respuesta(status, { status, campo, mensaje })

export function simularBackend() {
  const usuarios = usuariosIniciales()
  const tokensVencidos = new Set<string>()
  const llamadas: Llamada[] = []
  const mensajes: Record<string, unknown>[] = []
  let noLeidas = 2

  const sinPassword = (u: (typeof usuarios)[number]) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, idEjemplo, ...resto } = u
    return resto
  }
  const tokens = (u: (typeof usuarios)[number]) => ({
    token: `token-${u.id}`,
    refreshToken: `refresh-${u.id}`,
    tipo: 'Bearer',
    expiraEnMs: 1800000,
    usuario: sinPassword(u),
  })

  const fetchSimulado = vi.fn(async (url: RequestInfo | URL, init: RequestInit = {}) => {
    const direccion = new URL(String(url))
    const ruta = direccion.pathname.replace('/api/v1', '') + direccion.search
    const metodo = init.method ?? 'GET'
    const cuerpo = init.body ? JSON.parse(String(init.body)) : undefined
    const auth = new Headers(init.headers).get('Authorization')
    const token = auth?.replace('Bearer ', '') ?? null
    llamadas.push({ metodo, ruta, cuerpo, token })

    /* ---------- Rutas públicas ---------- */
    if (metodo === 'POST' && ruta === '/auth/login') {
      const u = usuarios.find((x) => x.correo.toLowerCase() === String(cuerpo.correo).toLowerCase())
      if (!u) return error(401, 'correo', 'No existe una cuenta registrada con este correo.')
      if (u.password !== cuerpo.password) return error(401, 'password', 'Contraseña incorrecta.')
      if (!u.activo) return error(403, 'correo', 'Tu cuenta está desactivada. Contacta a la clínica.')
      return respuesta(200, tokens(u))
    }
    if (metodo === 'POST' && ruta === '/auth/refresh') {
      const u = usuarios.find((x) => `refresh-${x.id}` === cuerpo.refreshToken)
      if (!u) return error(401, 'refreshToken', 'La sesión expiró. Inicia sesión nuevamente.')
      return respuesta(200, { ...tokens(u), token: `token-${u.id}-renovado` })
    }
    if (metodo === 'POST' && ruta === '/mensajes') {
      if (!/^(\+?56)?9\d{8}$/.test(String(cuerpo.telefono).replace(/[\s-]/g, ''))) {
        return error(400, 'telefono', 'Ingresa un celular chileno válido. Ejemplo: +56 9 1234 5678.')
      }
      const sesion = usuarios.find((x) => token?.startsWith(`token-${x.id}`))
      const nuevo = { ...cuerpo, id: mensajes.length + 1, estado: 'PENDIENTE', correoUsuario: sesion?.correo ?? null }
      mensajes.push(nuevo)
      return respuesta(201, nuevo)
    }

    /* ---------- Rutas protegidas: se valida el token ---------- */
    const yo = usuarios.find((x) => token === `token-${x.id}` || token === `token-${x.id}-renovado`)
    if (!yo || (token && tokensVencidos.has(token))) {
      return error(401, null, 'Debes iniciar sesión o tu token expiró.')
    }
    const esAdmin = yo.rol.nombre === 'ADMIN'
    const prohibido = () => error(403, null, 'No tienes permisos para realizar esta acción.')

    if (metodo === 'GET' && ruta === '/auth/me') return respuesta(200, sinPassword(yo))

    if (ruta === '/usuarios') {
      if (!esAdmin) return prohibido()
      if (metodo === 'GET') return respuesta(200, usuarios.map(sinPassword))
      if (metodo === 'POST') {
        if (usuarios.some((x) => x.correo === cuerpo.correo)) {
          return error(409, 'correo', 'Ya existe una cuenta registrada con este correo.')
        }
        const nuevo = { ...cuerpo, id: usuarios.length + 1, idEjemplo: '', avatar: null, fechaRegistro: new Date().toISOString() }
        usuarios.push(nuevo)
        return respuesta(201, sinPassword(nuevo))
      }
    }
    const coincideId = ruta.match(/^\/usuarios\/(\d+)$/)
    if (coincideId) {
      const indice = usuarios.findIndex((x) => x.id === Number(coincideId[1]))
      if (indice === -1) return error(404, 'id', 'El usuario no existe.')
      if (metodo === 'DELETE') {
        if (!esAdmin) return prohibido()
        usuarios.splice(indice, 1)
        return respuesta(204)
      }
      if (metodo === 'PUT') {
        if (!esAdmin && usuarios[indice].id !== yo.id) return prohibido()
        usuarios[indice] = { ...usuarios[indice], ...cuerpo }
        return respuesta(200, sinPassword(usuarios[indice]))
      }
      return respuesta(200, sinPassword(usuarios[indice]))
    }
    if (metodo === 'GET' && ruta === '/notificaciones/mis-notificaciones/no-leidas') {
      return respuesta(200, { cantidad: noLeidas })
    }
    if (metodo === 'PUT' && ruta === '/notificaciones/mis-notificaciones/leer-todas') {
      const marcadas = noLeidas
      noLeidas = 0
      return respuesta(200, { marcadas })
    }
    return error(404, null, `Ruta no simulada: ${metodo} ${ruta}`)
  })

  vi.stubGlobal('fetch', fetchSimulado)

  return {
    usuarios,
    mensajes,
    llamadas,
    fetch: fetchSimulado,
    /** Simula que el token de acceso venció (el refresh sigue sirviendo). */
    vencerToken: (token: string) => tokensVencidos.add(token),
    /** Busca un usuario por el id de los datos de ejemplo (ej: "admin-maria"). */
    porIdEjemplo: (idEjemplo: string) => usuarios.find((u) => u.idEjemplo === idEjemplo)!,
  }
}

/**
 * Deja una sesión iniciada como si el usuario hubiera hecho login:
 * guarda el usuario y sus tokens en localStorage.
 * Recibe el id de los datos de ejemplo (ej: "admin-maria", "cli-001").
 */
export function iniciarSesionDePrueba(idEjemplo: string): void {
  const datos = [...CUENTAS_FIJAS, ...CLIENTES_EJEMPLO]
  const indice = datos.findIndex((u) => u.id === idEjemplo)
  if (indice === -1) throw new Error(`No existe el usuario de ejemplo "${idEjemplo}"`)
  const usuario: Usuario = { ...datos[indice] }
  guardarSesion(usuario)
  guardarTokens(`token-${indice + 1}`, `refresh-${indice + 1}`) // mismos ids que simularBackend()
}
