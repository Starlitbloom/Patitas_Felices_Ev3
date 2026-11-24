/* =========================================================
   Pruebas P16–P19 — Integración con mascota-service,
   historial-service y servicio-clinico-service (EP3).
   El backend se simula con backendSimulado.ts: responde con las
   mismas reglas que los microservicios reales (roles, 403, 409...).
========================================================= */

// Herramientas de Vitest
import { beforeEach, expect, test } from 'vitest'
// Herramientas de Testing Library
import { render, screen } from '@testing-library/react'
// Backend simulado y sesión de prueba
import { ID_MASCOTA, iniciarSesionDePrueba, simularBackend } from './backendSimulado'
// Funciones del servicio que se prueban
import {
  agregarVacuna,
  aprobarSolicitud,
  enviarCambiosMascota,
  listarMascotas,
  listarSolicitudesPendientes,
  obtenerMascotaPorId,
  obtenerVacunas,
} from '../services/mascotasService'
// Componente que pide el catálogo a servicio-clinico-service
import { SelectorServicios } from '../componentes/organismos/SelectorServicios'

let backend: ReturnType<typeof simularBackend>
beforeEach(() => {
  localStorage.clear()
  backend = simularBackend()
})

test('P16 - ROLES: un cliente solo ve sus mascotas y una ajena se trata como "no encontrada" (403)', async () => {
  // Camila es clienta y no tiene mascotas en los datos de ejemplo
  iniciarSesionDePrueba('cli-001')
  expect(await listarMascotas()).toHaveLength(0)
  // Rocky es de María: el backend responde 403 y el servicio lo convierte en null
  expect(await obtenerMascotaPorId(String(ID_MASCOTA.rocky))).toBe(null)

  // La administradora ve las 6 mascotas de la clínica
  iniciarSesionDePrueba('admin-maria')
  expect(await listarMascotas()).toHaveLength(6)
})

test('P17 - SOLICITUD: el cambio de una ficha completa queda pendiente hasta que el personal lo aprueba', async () => {
  const idRocky = String(ID_MASCOTA.rocky)

  // María (dueña de Rocky) propone una raza nueva: Rocky tiene la ficha completa → queda pendiente
  iniciarSesionDePrueba('admin-maria')
  const envio = await enviarCambiosMascota(idRocky, { raza: 'Golden mestizo', sexo: 'Macho', peso: '29 kg', imagen: '', descripcion: '' })
  expect(envio.ok && envio.dato.estado).toBe('pendiente')
  expect((await obtenerMascotaPorId(idRocky))?.raza).toBe('Golden Retriever') // todavía no cambia

  // Un segundo cambio mientras hay uno pendiente → 409 del backend
  const repetido = await enviarCambiosMascota(idRocky, { raza: 'Otra', sexo: '', peso: '', imagen: '', descripcion: '' })
  expect(repetido.ok).toBe(false)

  // El personal aprueba: ahora sí se aplica a la mascota
  const [pendiente] = await listarSolicitudesPendientes()
  const aprobacion = await aprobarSolicitud(pendiente.id)
  expect(aprobacion.ok).toBe(true)
  expect((await obtenerMascotaPorId(idRocky))?.raza).toBe('Golden mestizo')
})

test('P18 - VACUNAS: registrar de nuevo una vacuna atrasada actualiza el registro (PUT) en vez de duplicarlo', async () => {
  const idLuna = String(ID_MASCOTA.luna)
  iniciarSesionDePrueba('admin-maria')

  // Luna tiene la triple felina con el refuerzo vencido
  const antes = await obtenerVacunas(idLuna)
  expect(antes).toHaveLength(1)
  expect(antes[0].estado).toBe('atrasada')

  // Se registra otra vez con un refuerzo futuro (fechas en el formato de la app)
  await agregarVacuna(idLuna, { vacuna: 'Vacuna triple felina (VA004)', fecha: '05 julio 2026', proximoRefuerzo: '05 julio 2099', estado: 'al-dia' })

  // Sigue habiendo una sola vacuna, ahora al día, y se usó PUT /historial/vacunas/{id}
  const despues = await obtenerVacunas(idLuna)
  expect(despues).toHaveLength(1)
  expect(despues[0].estado).toBe('al-dia')
  expect(backend.llamadas.some((l) => l.metodo === 'PUT' && l.ruta.startsWith('/historial/vacunas/'))).toBe(true)
})

test('P19 - CATÁLOGO: los servicios de una atención vienen de servicio-clinico-service filtrados por especie', async () => {
  // Formulario de un AVE: no debe ofrecer esterilizaciones de perro
  render(
    <SelectorServicios
      especie="Ave"
      aplicadas={[]}
      servicios={[]}
      onCambiarServicios={() => {}}
      vacunasNuevas={{}}
      onCambiarVacunas={() => {}}
    />,
  )
  // Llega desde el backend (findBy espera la respuesta)
  expect(await screen.findByText('Desparasitación interna ave')).toBeInTheDocument()
  expect(screen.getByText('Hemograma completo')).toBeInTheDocument() // sirve para todas las especies
  expect(screen.queryByText('Esterilización hembra canina')).toBe(null)
  // El catálogo es público: la petición se hizo sin token
  expect(backend.llamadas.find((l) => l.ruta.startsWith('/servicios'))?.token).toBe(null)
})
