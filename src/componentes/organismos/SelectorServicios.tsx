/* ORGANISMO — Servicios realizados en una atención, en un desplegable con casillas (se pueden marcar varias).
   Va debajo de "Estado del paciente". Cerrado muestra cuántos servicios hay marcados.
   Grupos: Vacunación (según la especie), Cirugía, Desparasitación, Exámenes y Otros.
   - Una vacuna que el paciente ya tiene al día aparece marcada y bloqueada, con su fecha y su refuerzo.
   - Al marcar una vacuna nueva aparece su fecha de próximo refuerzo (por defecto, en un año).
   Es un componente controlado: el formulario que lo usa guarda lo marcado.
   EP3: Cirugía, Desparasitación, Exámenes y Otros se leen de servicio-clinico-service (8084).
   Las vacunas siguen saliendo del catálogo local (se guardan en historial-service). */
import { useEffect, useState } from 'react'
import type { Especie, RegistroVacuna } from '../../types/mascota'
import { CATALOGO_VACUNAS, type GrupoServicios } from '../../data/serviciosClinica'
import { listarGruposServicios } from '../../services/serviciosClinicosService'
import { mensajeDeError } from '../../services/api'
import { buscarVacuna, estadoActualVacuna, refuerzoPorDefecto } from '../../utils/vacunas'
import { CampoFecha } from '../moleculas/CampoFecha'

export interface SelectorServiciosProps {
  /** Especie de la mascota: decide qué vacunas se ofrecen. */
  especie: Especie
  /** Vacunas que la mascota ya tiene registradas. */
  aplicadas: RegistroVacuna[]
  /** Servicios marcados (sin contar las vacunas nuevas). */
  servicios: string[]
  onCambiarServicios: (servicios: string[]) => void
  /** Vacunas nuevas marcadas: nombre → fecha del próximo refuerzo ("2027-10-24"). */
  vacunasNuevas: Record<string, string>
  onCambiarVacunas: (vacunas: Record<string, string>) => void
  /** Errores por nombre de vacuna (ej: refuerzo sin fecha). */
  erroresVacunas?: Record<string, string>
}

export function SelectorServicios({
  especie,
  aplicadas,
  servicios,
  onCambiarServicios,
  vacunasNuevas,
  onCambiarVacunas,
  erroresVacunas = {},
}: SelectorServiciosProps) {
  const catalogo = CATALOGO_VACUNAS[especie] ?? []

  /* Si el desplegable está abierto */
  const [abierto, setAbierto] = useState(false)

  /* Catálogo de servicios para la especie (viene del backend) y error si no se pudo cargar */
  const [grupos, setGrupos] = useState<GrupoServicios[]>([])
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null)

  /* Al abrir el formulario (o cambiar la especie) se pide el catálogo a servicio-clinico-service */
  useEffect(() => {
    let activo = true
    listarGruposServicios(especie)
      .then((lista) => {
        if (!activo) return
        setGrupos(lista)
        setErrorCatalogo(null)
      })
      .catch((error) => activo && setErrorCatalogo(mensajeDeError(error)))
    return () => {
      activo = false
    }
  }, [especie])

  /* Si hay un error en alguna fecha de refuerzo, se abre solo para que se vea */
  const hayErrores = Object.keys(erroresVacunas).length > 0
  useEffect(() => {
    if (hayErrores) setAbierto(true)
  }, [hayErrores])

  /* Cuántos servicios hay marcados (vacunas nuevas + el resto) */
  const total = servicios.length + Object.keys(vacunasNuevas).length

  /* Marca o desmarca un servicio que no es vacuna */
  const alternarServicio = (nombre: string) => {
    onCambiarServicios(servicios.includes(nombre) ? servicios.filter((s) => s !== nombre) : [...servicios, nombre])
  }

  /* Marca o desmarca una vacuna nueva (al marcarla propone el refuerzo en un año) */
  const alternarVacuna = (nombre: string) => {
    const copia = { ...vacunasNuevas }
    if (nombre in copia) delete copia[nombre]
    else copia[nombre] = refuerzoPorDefecto()
    onCambiarVacunas(copia)
  }

  return (
    <details className="selector-servicios" open={abierto} onToggle={(e) => setAbierto(e.currentTarget.open)}>
      {/* Fila que se pulsa para abrir o cerrar */}
      <summary>
        <span>Servicios realizados</span>
        <span className="selector-servicios-resumen">{total === 0 ? 'Ninguno' : `${total} seleccionado${total === 1 ? '' : 's'}`}</span>
      </summary>

      <div className="selector-servicios-lista">
        {/* Grupo de vacunas */}
        <div className="servicios-grupo">
          <h4>Vacunación</h4>
          {catalogo.length === 0 ? (
            <p className="campo__ayuda">La clínica aún no tiene un catálogo de vacunas para {especie.toLowerCase()}s.</p>
          ) : (
            catalogo.map((nombre, indice) => {
              const existente = buscarVacuna(aplicadas, nombre)
              const estado = existente ? estadoActualVacuna(existente) : null
              const bloqueada = estado === 'al-dia' // ya vacunado y sin refuerzo cerca
              const marcada = bloqueada || nombre in vacunasNuevas

              return (
                <div key={nombre}>
                  <label className={`servicio-opcion ${bloqueada ? 'servicio-opcion--bloqueada' : ''}`.trim()}>
                    <input type="checkbox" checked={marcada} disabled={bloqueada} onChange={() => alternarVacuna(nombre)} />
                    <span>
                      {nombre}
                      {/* Qué se sabe de esta vacuna en el paciente */}
                      {existente && estado !== 'atrasada' && (
                        <small className="servicio-detalle">
                          Aplicada el {existente.fecha} · refuerzo {existente.proximoRefuerzo}
                        </small>
                      )}
                      {existente && estado === 'atrasada' && (
                        <small className="servicio-detalle servicio-detalle--atrasada">
                          Refuerzo atrasado: venció el {existente.proximoRefuerzo}
                        </small>
                      )}
                    </span>
                  </label>

                  {/* Fecha del próximo refuerzo de la vacuna recién marcada */}
                  {nombre in vacunasNuevas && (
                    <div className="servicio-refuerzo">
                      <CampoFecha
                        id={`refuerzo-${indice}`}
                        etiqueta="Próximo refuerzo"
                        valor={vacunasNuevas[nombre]}
                        onCambio={(valor) => onCambiarVacunas({ ...vacunasNuevas, [nombre]: valor })}
                        error={erroresVacunas[nombre]}
                      />
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Si servicio-clinico-service no respondió, se avisa (las vacunas igual se pueden marcar) */}
        {errorCatalogo && <p className="campo__ayuda">⚠️ {errorCatalogo}</p>}

        {/* Cirugía, Desparasitación, Exámenes y Otros: el backend ya los entrega filtrados por especie */}
        {grupos.map(({ grupo, servicios: disponibles }) => {
          if (disponibles.length === 0) return null // grupo sin servicios para esta especie
          return (
            <div className="servicios-grupo" key={grupo}>
              <h4>{grupo}</h4>
              {disponibles.map(({ nombre }) => (
                <label className="servicio-opcion" key={nombre}>
                  <input type="checkbox" checked={servicios.includes(nombre)} onChange={() => alternarServicio(nombre)} />
                  <span>{nombre}</span>
                </label>
              ))}
            </div>
          )
        })}
      </div>
    </details>
  )
}