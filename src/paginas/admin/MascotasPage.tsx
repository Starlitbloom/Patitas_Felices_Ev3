/* PÁGINA — Panel admin de mascotas (ruta /admin/mascotas): CRUD completo.
   EP3: todo se guarda en los microservicios:
   - mascotas y solicitudes de cambio → mascota-service (8082)
   - atenciones y vacunas             → historial-service (8083)
   - catálogo de servicios            → servicio-clinico-service (8084), desde SelectorServicios
   Por eso cada acción es asíncrona (await) y, al terminar, se vuelve a pedir la lista. */
import { useCallback, useEffect, useState } from 'react'
import type { EstadoMascota, Mascota, RegistroClinico, RegistroVacuna, SolicitudCambio } from '../../types/mascota'
import {
  actualizarMascota,
  agregarRegistroClinico,
  agregarVacuna,
  aprobarSolicitud,
  crearMascota,
  eliminarMascota,
  eliminarVacuna,
  listarMascotas,
  listarSolicitudesPendientes,
  obtenerHistorial,
  obtenerVacunas,
  rechazarSolicitud,
} from '../../services/mascotasService'
import { mensajeDeError } from '../../services/api'
import { EncabezadoAdmin } from '../../componentes/organismos/EncabezadoAdmin'
import { FiltrosMascotasAdmin, type FiltrosMascotasAdminValor } from '../../componentes/organismos/FiltrosMascotasAdmin'
import { TablaMascotas } from '../../componentes/organismos/TablaMascotas'
import { TablaSolicitudesMascotas } from '../../componentes/organismos/TablaSolicitudesMascotas'
import { TablaHistorialPacientes, type ResumenClinico } from '../../componentes/organismos/TablaHistorialPacientes'
import { DetalleHistorialPaciente } from '../../componentes/organismos/DetalleHistorialPaciente'
import { Modal } from '../../componentes/organismos/Modal'
import { ModalConfirmacion } from '../../componentes/organismos/ModalConfirmacion'
import { FormularioMascota, type DatosFormularioMascota } from '../../componentes/organismos/FormularioMascota'
import { FormularioAtencion } from '../../componentes/organismos/FormularioAtencion'
import { FormularioVacuna } from '../../componentes/organismos/FormularioVacuna'
import { Boton } from '../../componentes/atomos/Boton'

const FILTROS_INICIALES: FiltrosMascotasAdminValor = { texto: '', especie: '' }

type EstadoModal = { tipo: 'crear' } | { tipo: 'editar'; mascota: Mascota } | null
/* Registro clínico que se está llenando: de qué tipo y para qué mascota (null = cerrado) */
type EstadoClinico = { tipo: 'atencion' | 'vacuna'; mascota: Mascota } | null

export default function MascotasPage() {
  const [mascotas, setMascotas] = useState<Mascota[]>([])
  const [filtros, setFiltros] = useState<FiltrosMascotasAdminValor>(FILTROS_INICIALES)
  const [modal, setModal] = useState<EstadoModal>(null)
  const [aEliminar, setAEliminar] = useState<Mascota | null>(null)
  const [solicitudes, setSolicitudes] = useState<SolicitudCambio[]>([])
  const [aRechazar, setARechazar] = useState<SolicitudCambio | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [clinico, setClinico] = useState<EstadoClinico>(null)
    /* Paciente cuyo historial se está viendo (null = ventana cerrada) */
  const [verHistorial, setVerHistorial] = useState<Mascota | null>(null)
  /* Historial y vacunas de cada mascota (para la tabla de historial y los formularios clínicos) */
  const [resumenClinico, setResumenClinico] = useState<Record<string, ResumenClinico>>({})
  /* Mientras se cargan los datos la primera vez, y error si un microservicio no respondió */
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const visibles = mascotas.filter(
    (m) =>
      (!filtros.texto.trim() || m.nombre.toLowerCase().includes(filtros.texto.trim().toLowerCase())) &&
      (!filtros.especie || m.especie === filtros.especie),
  )

  /* Pide el historial y las vacunas de UNA mascota y los guarda en el mapa "resumenClinico" */
  const cargarClinico = useCallback(async (id: string) => {
    const [historial, vacunas] = await Promise.all([obtenerHistorial(id), obtenerVacunas(id)])
    setResumenClinico((prev) => ({ ...prev, [id]: { historial, vacunas } }))
  }, [])

  /* Pide todo a los microservicios: mascotas, solicitudes pendientes y el historial de cada mascota */
  const pedirTodo = useCallback(async () => {
    const [lista, pendientes] = await Promise.all([listarMascotas(), listarSolicitudesPendientes()])
    const clinicos = await Promise.all(
      lista.map(async (m) => {
        const [historial, vacunas] = await Promise.all([obtenerHistorial(m.id), obtenerVacunas(m.id)])
        return [m.id, { historial, vacunas }] as const
      }),
    )
    return { lista, pendientes, clinico: Object.fromEntries(clinicos) as Record<string, ResumenClinico> }
  }, [])

  /* Guarda en pantalla lo que respondió el backend (o el error si un microservicio no respondió) */
  const aplicar = useCallback((resultado: Awaited<ReturnType<typeof pedirTodo>> | { error: string }) => {
    if ('error' in resultado) {
      setErrorCarga(resultado.error)
    } else {
      setMascotas(resultado.lista)
      setSolicitudes(resultado.pendientes)
      setResumenClinico(resultado.clinico)
      setErrorCarga(null)
    }
    setCargando(false)
  }, [])

  /* Vuelve a pedir todo (se usa después de crear, editar, eliminar, aprobar...) */
  const recargar = useCallback(async () => {
    aplicar(await pedirTodo().catch((error) => ({ error: mensajeDeError(error) })))
  }, [pedirTodo, aplicar])

  /* Al entrar al panel se cargan los datos */
  useEffect(() => {
    let activo = true
    pedirTodo()
      .catch((error) => ({ error: mensajeDeError(error) }))
      .then((resultado) => activo && aplicar(resultado))
    return () => {
      activo = false
    }
  }, [pedirTodo, aplicar])

  /* Vacunas registradas de una mascota (para avisar en los formularios cuáles ya tiene) */
  const vacunasDe = (id: string) => resumenClinico[id]?.vacunas ?? []

  const nombreMascota = (id: string) => mascotas.find((m) => m.id === id)?.nombre ?? id
    /* Foto actual de la mascota (para la tabla de solicitudes) */
  const imagenMascota = (id: string) => mascotas.find((m) => m.id === id)?.imagen ?? ''

  const aprobar = async (solicitud: SolicitudCambio) => {
    const resultado = await aprobarSolicitud(solicitud.id)
    setAviso(resultado.ok ? `Cambios de ${nombreMascota(solicitud.mascotaId)} aprobados.` : `⚠️ ${resultado.mensaje}`)
    await recargar()
  }

  const confirmarRechazo = async () => {
    if (!aRechazar) return
    const resultado = await rechazarSolicitud(aRechazar.id)
    setAviso(resultado.ok ? `Solicitud de ${nombreMascota(aRechazar.mascotaId)} rechazada.` : `⚠️ ${resultado.mensaje}`)
    setARechazar(null)
    await recargar()
  }

  const crear = async (datos: DatosFormularioMascota) => {
    const resultado = await crearMascota({ ...datos, especie: datos.especie || 'Perro', completo: true })
    if (!resultado.ok) return { campo: resultado.campo, mensaje: resultado.mensaje }
    setModal(null)
    setAviso(`Mascota ${resultado.dato.nombre} creada correctamente.`)
    await recargar()
  }

  const editar = (id: string) => async (datos: DatosFormularioMascota) => {
    const resultado = await actualizarMascota(id, { ...datos, especie: datos.especie || 'Perro' })
    if (!resultado.ok) return { campo: resultado.campo, mensaje: resultado.mensaje }
    setModal(null)
    setAviso(`Cambios de ${resultado.dato.nombre} guardados.`)
    await recargar()
  }

  const confirmarEliminacion = async () => {
    if (!aEliminar) return
    const resultado = await eliminarMascota(aEliminar.id)
    setAviso(resultado.ok ? `Mascota ${aEliminar.nombre} eliminada.` : `⚠️ ${resultado.mensaje}`)
    setAEliminar(null)
    await recargar()
  }
    /* Guarda la atención en el historial, las vacunas marcadas en el calendario del paciente
     y, si el veterinario cambió el estado del paciente, lo actualiza */
  const guardarAtencion =
    (mascota: Mascota) => async (registro: RegistroClinico, estado: EstadoMascota, vacunasNuevas: RegistroVacuna[]) => {
      setClinico(null)
      try {
        await agregarRegistroClinico(mascota.id, registro) // historial-service
        for (const vacuna of vacunasNuevas) await agregarVacuna(mascota.id, vacuna) // historial-service
        if (estado !== mascota.estado) {
          const resultado = await actualizarMascota(mascota.id, { estado }) // mascota-service
          if (!resultado.ok) throw new Error(resultado.mensaje)
        }
        setAviso(`Atención de ${mascota.nombre} registrada correctamente.`)
      } catch (error) {
        setAviso(`⚠️ ${error instanceof Error ? error.message : mensajeDeError(error)}`)
      }
      await recargar() // vuelve a leer la tabla para que se vea el estado nuevo
    }

  /* Guarda la vacuna en el calendario de la mascota (historial-service) y cierra el formulario */
  const guardarVacuna = (mascota: Mascota) => async (registro: RegistroVacuna) => {
    setClinico(null)
    try {
      await agregarVacuna(mascota.id, registro)
      setAviso(`Vacuna de ${mascota.nombre} registrada correctamente.`)
    } catch (error) {
      setAviso(`⚠️ ${mensajeDeError(error)}`)
    }
    await cargarClinico(mascota.id).catch(() => {}) // si historial-service no responde, la tabla queda como estaba
  }

  /* Quita un registro de vacuna (ej: uno de prueba o mal ingresado) y refresca el aviso del formulario.
     El formulario entrega la posición en la lista; con ella se busca el id real de la vacuna. */
  const quitarVacuna = (mascota: Mascota) => async (indice: number) => {
    const vacuna = vacunasDe(mascota.id)[indice]
    if (!vacuna?.id) return
    try {
      await eliminarVacuna(vacuna.id)
    } catch (error) {
      setAviso(`⚠️ ${mensajeDeError(error)}`)
    }
    await cargarClinico(mascota.id).catch(() => {})
  }

  return (
    <>
      <EncabezadoAdmin>Mantenedor de mascotas 🐾</EncabezadoAdmin>

      {aviso && (
        <div className="admin-aviso" role="status">
          {aviso}
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}

      {errorCarga && (
        <div className="admin-aviso" role="alert">
          ⚠️ {errorCarga}
        </div>
      )}
      {cargando && <p role="status">Cargando mascotas…</p>}

      <div className="admin-seccion-cabecera">
        <div>
          <h2>Solicitudes de cambio pendientes</h2>
          <p>Cambios que un dueño propuso sobre una mascota ya registrada.</p>
        </div>
      </div>

      <section className="admin-tabla-seccion">
        <TablaSolicitudesMascotas 
          solicitudes={solicitudes} 
          nombreMascota={nombreMascota} 
          imagenMascota={imagenMascota} 
          onAprobar={aprobar} 
          onRechazar={setARechazar} 
        />
      </section>

      <div className="admin-seccion-cabecera">
        <div>
          <h2>Mascotas registradas</h2>
          <p>Administra los pacientes registrados en Patitas Felices.</p>
        </div>
        <Boton variante="exportar" onClick={() => setModal({ tipo: 'crear' })}>
          + Nueva mascota
        </Boton>
      </div>

      <FiltrosMascotasAdmin
        filtros={filtros}
        onCambio={setFiltros}
        onLimpiar={() => setFiltros(FILTROS_INICIALES)}
        totalResultados={visibles.length}
      />

      <section className="admin-tabla-seccion">
        <TablaMascotas mascotas={visibles}
          onEditar={(m) => setModal({ tipo: 'editar', mascota: m })} 
          onEliminar={setAEliminar} 
          onAtencion={(m) => setClinico({ tipo: 'atencion', mascota: m })} 
          onVacuna={(m) => setClinico({ tipo: 'vacuna', mascota: m })}
        />
      </section>
            {/* Historial clínico por paciente: una fila por mascota con sus atenciones, vacunas y servicios */}
      <div className="admin-seccion-cabecera">
        <div>
          <h2>Historial clínico de pacientes</h2>
          <p>Revisa las atenciones, vacunas y servicios realizados a cada paciente.</p>
        </div>
      </div>

      <section className="admin-tabla-seccion">
        {/* Usa la lista filtrada: el buscador de arriba también aplica aquí */}
        <TablaHistorialPacientes
          mascotas={visibles}
          clinico={resumenClinico}
          onVer={setVerHistorial}
        />
      </section>

      <Modal abierto={modal !== null} titulo={modal?.tipo === 'editar' ? 'Editar mascota' : 'Nueva mascota'} onCerrar={() => setModal(null)} ancho>
        {modal?.tipo === 'crear' && <FormularioMascota modo="crear" onSubmit={crear} onCancelar={() => setModal(null)} />}
        {modal?.tipo === 'editar' && (
          <FormularioMascota
            key={modal.mascota.id}
            modo="editar"
            valoresIniciales={modal.mascota}
            onSubmit={editar(modal.mascota.id)}
            onCancelar={() => setModal(null)}
          />
        )}
      </Modal>

      {/* Formulario de atención o de vacuna, según el botón que se pulsó */}
      <Modal
        abierto={clinico !== null}
        titulo={clinico?.tipo === 'vacuna' ? `Registrar vacuna · ${clinico.mascota.nombre}` : `Registrar atención · ${clinico?.mascota.nombre ?? ''}`}
        onCerrar={() => setClinico(null)}
        ancho
      >
        {clinico?.tipo === 'atencion' && (
          <FormularioAtencion
            key={clinico.mascota.id}
            especie={clinico.mascota.especie}
            estadoActual={clinico.mascota.estado}
            aplicadas={vacunasDe(clinico.mascota.id)}
            onSubmit={guardarAtencion(clinico.mascota)}
            onCancelar={() => setClinico(null)}
          />
        )}
        {clinico?.tipo === 'vacuna' && (
          <FormularioVacuna
            key={clinico.mascota.id}
            especie={clinico.mascota.especie}
            aplicadas={vacunasDe(clinico.mascota.id)}
            onSubmit={guardarVacuna(clinico.mascota)}
            onCancelar={() => setClinico(null)}
            onEliminar={quitarVacuna(clinico.mascota)}
          />
        )}
      </Modal>
      {/* Ventana con el historial completo del paciente (foto, atenciones, servicios y vacunas) */}
      <Modal
        abierto={verHistorial !== null}
        titulo={`Historial · ${verHistorial?.nombre ?? ''}`}
        onCerrar={() => setVerHistorial(null)}
        ancho
      >
        {verHistorial && <DetalleHistorialPaciente mascota={verHistorial} />}
      </Modal>
      
      <ModalConfirmacion
        abierto={aEliminar !== null}
        titulo="Eliminar mascota"
        mensaje={`¿Eliminar a ${aEliminar?.nombre ?? ''}? Esta acción no se puede deshacer.`}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setAEliminar(null)}
      />

      <ModalConfirmacion
        abierto={aRechazar !== null}
        titulo="Rechazar solicitud"
        mensaje="¿Rechazar esta solicitud de cambio?"
        textoConfirmar="Rechazar"
        onConfirmar={confirmarRechazo}
        onCancelar={() => setARechazar(null)}
      />
    </>
  )
}