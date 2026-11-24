/* =========================================================
   Backend simulado para las pruebas (EP3).
   Reemplaza fetch por una función que responde como los
   microservicios reales: auth-service, contacto-service,
   notificacion-service, mascota-service, historial-service y
   servicio-clinico-service. Así las pruebas recorren el código real
   (api.ts, servicios, contexto y páginas) sin levantar Spring Boot.

   Reglas que imita del backend:
   - token "token-<id>" y refreshToken "refresh-<id>"
   - 401 si falta el token o está en la lista de vencidos
   - 403 si el rol no tiene permiso (ej: un cliente pidiendo /usuarios)
   - errores con el formato { status, campo, mensaje }
   - mascotas: el personal ve todas y un cliente solo las suyas
   - GET /servicios es público (catálogo de servicio-clinico-service)
========================================================= */
import { vi } from 'vitest'
import { CLIENTES_EJEMPLO, CUENTAS_FIJAS } from '../data/usuariosIniciales'
import { HISTORIALES_INICIALES, MASCOTAS_INICIALES, VACUNAS_INICIALES } from '../data/mascotasIniciales'
import { GRUPOS_SERVICIOS } from '../data/serviciosClinica'
import type { Usuario, UsuarioApi } from '../types/usuario'
import type { AtencionApi, MascotaApi, SolicitudApi, VacunaApi } from '../services/mascotasService'
import type { ServicioClinicoApi } from '../services/serviciosClinicosService'
import { fechaTextoAIso } from '../utils/fechas'
import { calcularEstadoVacuna } from '../utils/vacunas'
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

/* ---------- Datos iniciales de mascota-service, historial-service y servicio-clinico-service ----------
   Mismos datos y mismo orden que cargan los DataLoader del backend: Rocky = 1, Luna = 2, Max = 3... */

/** Id del backend (1, 2, 3...) de cada mascota de ejemplo ("rocky" → 1). */
export const ID_MASCOTA: Record<string, number> = Object.fromEntries(MASCOTAS_INICIALES.map((m, i) => [m.id, i + 1]))

function mascotasIniciales(): MascotaApi[] {
  return MASCOTAS_INICIALES.map((m, i) => ({
    id: i + 1,
    nombre: m.nombre,
    especie: m.especie,
    raza: m.raza || null,
    edad: m.edad || null,
    sexo: m.sexo || null,
    peso: m.peso || null,
    nombreDueno: m.dueño,
    correoDueno: m.correoDueño,
    completo: m.completo,
    imagen: m.imagen || null,
    estado: m.estado,
    descripcion: m.descripcion || null,
  }))
}

function atencionesIniciales(): AtencionApi[] {
  let id = 0
  return Object.entries(HISTORIALES_INICIALES).flatMap(([slug, lista]) =>
    lista.map((a) => ({
      id: ++id,
      mascotaId: ID_MASCOTA[slug],
      fecha: fechaTextoAIso(a.fecha),
      motivo: a.motivo,
      diagnostico: a.diagnostico,
      tratamiento: a.tratamiento,
      veterinario: a.veterinario,
      servicios: a.servicios ?? [],
    })),
  )
}

/** Vacuna con el estado calculado igual que historial-service (según el próximo refuerzo). */
const conEstado = (v: Omit<VacunaApi, 'estado'>): VacunaApi => ({ ...v, estado: calcularEstadoVacuna(v.proximoRefuerzo) })

function vacunasIniciales(): Omit<VacunaApi, 'estado'>[] {
  let id = 0
  return Object.entries(VACUNAS_INICIALES).flatMap(([slug, lista]) =>
    lista.map((v) => ({
      id: ++id,
      mascotaId: ID_MASCOTA[slug],
      vacuna: v.vacuna,
      fecha: fechaTextoAIso(v.fecha),
      proximoRefuerzo: fechaTextoAIso(v.proximoRefuerzo),
    })),
  )
}

function serviciosIniciales(): ServicioClinicoApi[] {
  let id = 0
  return GRUPOS_SERVICIOS.flatMap(({ grupo, servicios }) =>
    servicios.map((sv) => ({ id: ++id, grupo, nombre: sv.nombre, activo: true, especies: sv.especies ?? [] })),
  )
}

export function simularBackend() {
  const usuarios = usuariosIniciales()
  const tokensVencidos = new Set<string>()
  const llamadas: Llamada[] = []
  const mensajes: Record<string, unknown>[] = []
  let noLeidas = 2
  const mascotas = mascotasIniciales()
  const solicitudes: SolicitudApi[] = []
  const atenciones = atencionesIniciales()
  const vacunas = vacunasIniciales()
  const servicios = serviciosIniciales()

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
    const ruta = direccion.pathname.replace(/^.*\/api\/v1/, '') + direccion.search
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

    /* Catálogo de servicio-clinico-service: público, filtrable por especie */
    if (metodo === 'GET' && direccion.pathname.endsWith('/servicios')) {
      const especie = direccion.searchParams.get('especie')
      return respuesta(
        200,
        servicios.filter((sv) => !especie || sv.especies.length === 0 || sv.especies.some((e) => e.toLowerCase() === especie.toLowerCase())),
      )
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
    /* ---------- mascota-service (8082) ---------- */
    const esPersonal = esAdmin || yo.rol.nombre === 'RECEPCIONISTA'
    const camino = direccion.pathname.replace(/^.*\/api\/v1/, '')
    const esDe = (m: MascotaApi) => esPersonal || m.correoDueno.toLowerCase() === yo.correo.toLowerCase()
    const completa = (m: MascotaApi) => !!(m.raza && m.sexo && m.peso && m.imagen)

    if (camino === '/mascotas') {
      if (metodo === 'GET') return respuesta(200, mascotas.filter(esDe))
      if (metodo === 'POST') {
        const nueva: MascotaApi = { ...cuerpo, id: mascotas.length ? Math.max(...mascotas.map((m) => m.id)) + 1 : 1 }
        if (!esPersonal) nueva.correoDueno = yo.correo // un cliente solo registra mascotas a su nombre
        nueva.estado = nueva.estado || 'al-dia'
        nueva.completo = completa(nueva)
        mascotas.push(nueva)
        return respuesta(201, nueva)
      }
    }
    const rutaMascota = camino.match(/^\/mascotas\/(\d+)(\/solicitudes)?$/)
    if (rutaMascota) {
      const indice = mascotas.findIndex((m) => m.id === Number(rutaMascota[1]))
      if (indice === -1) return error(404, null, `Mascota ${rutaMascota[1]} no encontrada`)
      const mascota = mascotas[indice]
      if (rutaMascota[2]) {
        if (!esDe(mascota)) return prohibido()
        if (metodo === 'GET') return respuesta(200, solicitudes.filter((x) => x.mascotaId === mascota.id).reverse())
        // POST: incompleta → se aplica al tiro; completa → queda pendiente (una a la vez)
        const ahora = new Date().toISOString()
        const nueva: SolicitudApi = {
          ...cuerpo,
          id: solicitudes.length + 1,
          mascotaId: mascota.id,
          correoSolicitante: yo.correo,
          estado: 'pendiente',
          fechaSolicitud: ahora,
          fechaResolucion: null,
        }
        if (!mascota.completo) {
          Object.assign(mascota, Object.fromEntries(Object.entries(cuerpo).filter(([, v]) => v)))
          mascota.completo = completa(mascota)
          Object.assign(nueva, { estado: 'aprobada', fechaResolucion: ahora })
        } else if (solicitudes.some((x) => x.mascotaId === mascota.id && x.estado === 'pendiente')) {
          return error(409, null, 'La mascota ya tiene una solicitud de cambio pendiente')
        }
        solicitudes.push(nueva)
        return respuesta(201, nueva)
      }
      if (metodo === 'GET') return esDe(mascota) ? respuesta(200, mascota) : prohibido()
      if (metodo === 'PUT') {
        if (!esPersonal) return prohibido()
        mascotas[indice] = { ...mascota, ...cuerpo, id: mascota.id }
        mascotas[indice].completo = completa(mascotas[indice])
        return respuesta(200, mascotas[indice])
      }
      if (metodo === 'DELETE') {
        if (!esAdmin) return prohibido()
        mascotas.splice(indice, 1)
        return respuesta(204)
      }
    }
    if (camino === '/solicitudes' && metodo === 'GET') {
      if (!esPersonal) return prohibido()
      const estado = direccion.searchParams.get('estado')
      return respuesta(200, solicitudes.filter((x) => !estado || x.estado === estado))
    }
    const rutaSolicitud = camino.match(/^\/solicitudes\/(\d+)\/(aprobar|rechazar)$/)
    if (rutaSolicitud && metodo === 'PUT') {
      if (!esPersonal) return prohibido()
      const solicitud = solicitudes.find((x) => x.id === Number(rutaSolicitud[1]))
      if (!solicitud) return error(404, null, 'Solicitud no encontrada')
      if (solicitud.estado !== 'pendiente') return error(409, null, 'La solicitud ya fue resuelta')
      if (rutaSolicitud[2] === 'aprobar') {
        const mascota = mascotas.find((m) => m.id === solicitud.mascotaId)
        if (mascota) {
          const { raza, sexo, peso, imagen, descripcion } = solicitud
          Object.assign(mascota, Object.fromEntries(Object.entries({ raza, sexo, peso, imagen, descripcion }).filter(([, v]) => v)))
          mascota.completo = completa(mascota)
        }
      }
      Object.assign(solicitud, { estado: rutaSolicitud[2] === 'aprobar' ? 'aprobada' : 'rechazada', fechaResolucion: new Date().toISOString() })
      return respuesta(200, solicitud)
    }

    /* ---------- historial-service (8083) ---------- */
    const rutaHistorial = camino.match(/^\/historial\/mascotas\/(\d+)\/(atenciones|vacunas)$/)
    if (rutaHistorial) {
      const mascotaId = Number(rutaHistorial[1])
      const esAtencion = rutaHistorial[2] === 'atenciones'
      const porFecha = <T extends { fecha: string }>(a: T, b: T) => b.fecha.localeCompare(a.fecha)
      if (metodo === 'GET') {
        return esAtencion
          ? respuesta(200, atenciones.filter((a) => a.mascotaId === mascotaId).sort(porFecha))
          : respuesta(200, vacunas.filter((v) => v.mascotaId === mascotaId).sort(porFecha).map(conEstado))
      }
      if (metodo === 'POST') {
        if (!esPersonal) return prohibido()
        if (esAtencion) {
          const nueva: AtencionApi = { ...cuerpo, id: atenciones.length + 1, mascotaId, servicios: cuerpo.servicios ?? [] }
          atenciones.push(nueva)
          return respuesta(201, nueva)
        }
        if (cuerpo.proximoRefuerzo <= cuerpo.fecha) {
          return error(409, null, 'El proximo refuerzo debe ser posterior a la fecha de aplicacion')
        }
        const nueva = { ...cuerpo, id: vacunas.length + 1, mascotaId }
        vacunas.push(nueva)
        return respuesta(201, conEstado(nueva))
      }
    }
    const rutaVacuna = camino.match(/^\/historial\/vacunas\/(\d+)$/)
    if (rutaVacuna) {
      const indice = vacunas.findIndex((v) => v.id === Number(rutaVacuna[1]))
      if (indice === -1) return error(404, null, `Vacuna ${rutaVacuna[1]} no encontrada`)
      if (metodo === 'PUT') {
        if (!esPersonal) return prohibido()
        vacunas[indice] = { ...vacunas[indice], ...cuerpo }
        return respuesta(200, conEstado(vacunas[indice]))
      }
      if (metodo === 'DELETE') {
        if (!esAdmin) return prohibido()
        vacunas.splice(indice, 1)
        return respuesta(204)
      }
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
    mascotas,
    solicitudes,
    atenciones,
    vacunas,
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
