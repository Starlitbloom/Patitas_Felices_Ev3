/* ORGANISMO — Bloque "Editar" de una mascota.
   Se usa en el perfil del cliente y en el detalle de la mascota.
   EP3 — los cambios se envían a mascota-service (POST /mascotas/{id}/solicitudes):
   - si la ficha está INCOMPLETA, el backend aplica los datos al tiro;
   - si ya está COMPLETA, queda pendiente hasta que el personal la apruebe o rechace. */
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import type { CambiosSolicitud, Mascota, Sexo, SolicitudCambio } from '../../types/mascota'
import { enviarCambiosMascota, listarSolicitudesDeMascota } from '../../services/mascotasService'
import { redimensionarImagen, validarArchivoAvatar } from '../../utils/imagen'
import { Boton } from '../atomos/Boton'
import { MensajeError } from '../atomos/MensajeError'

export interface BloqueCompletarMascotaProps {
  mascota: Mascota
  /** Se avisa al guardar para que la página vuelva a leer los datos. */
  onGuardado: () => void
}

/* Campos que el dueño/a puede completar o cambiar */
const datosDe = (m: Mascota): CambiosSolicitud => ({
  raza: m.raza ?? '',
  sexo: m.sexo ?? '',
  peso: m.peso ?? '',
  imagen: m.imagen ?? '',
  descripcion: m.descripcion ?? '',
})

/* ¿El backend aplicó los datos al tiro? (ficha incompleta: se aprueba en el mismo segundo en que se envía) */
const aplicadaAlTiro = (s: SolicitudCambio) =>
  s.estado === 'aprobada' && !!s.fechaResolucion && s.fechaResolucion.slice(0, 19) === s.fechaSolicitud.slice(0, 19)

/* Ids de las respuestas que el dueño ya vio (guardados en el navegador) */
const CLAVE_AVISOS = 'avisosMascotaVistos'
function avisosVistos(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_AVISOS) ?? '[]') as string[]
  } catch {
    return []
  }
}
function marcarAvisoVisto(id: string) {
  try {
    localStorage.setItem(CLAVE_AVISOS, JSON.stringify([...avisosVistos(), id]))
  } catch {
    /* si el navegador no deja guardar, el aviso solo se esconde por ahora */
  }
}

export function BloqueCompletarMascota({ mascota, onGuardado }: BloqueCompletarMascotaProps) {
  const { id } = mascota

  /* Si el formulario está desplegado o escondido */
  const [abierto, setAbierto] = useState(false)

  /* Valores que se van escribiendo en el formulario (parten con los datos actuales) */
  const [datos, setDatos] = useState<CambiosSolicitud>(() => datosDe(mascota))

  /* Error de la raza (campo obligatorio) y error de otras cosas (foto, mascota inexistente) */
  const [errorRaza, setErrorRaza] = useState<string | null>(null)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  /* Referencia al input de archivo oculto, para abrirlo desde el botón "Subir foto" */
  const inputArchivo = useRef<HTMLInputElement>(null)

  /* Solicitudes de esta mascota (vienen de mascota-service, la más reciente primero) */
  const [solicitudes, setSolicitudes] = useState<SolicitudCambio[]>([])

  /* Mientras se envía, el botón Guardar queda deshabilitado */
  const [enviando, setEnviando] = useState(false)

  /* Al mostrar el bloque se piden las solicitudes de la mascota (el dueño solo ve las de sus mascotas) */
  useEffect(() => {
    let activo = true
    listarSolicitudesDeMascota(id)
      .then((lista) => activo && setSolicitudes(lista))
      .catch(() => activo && setSolicitudes([])) // si falla, simplemente no se muestran avisos
    return () => {
      activo = false
    }
  }, [id])

  /* Si ya envió cambios y aún no se resuelven, no puede enviar otros */
  const pendiente = solicitudes.find((s) => s.estado === 'pendiente') ?? null

  /* Última solicitud ya resuelta (aprobada o rechazada), para avisar al dueño qué pasó */
  const ultimaRespuesta = solicitudes.find((s) => s.estado !== 'pendiente')

  
  /* El aviso se muestra 6 segundos y luego desaparece (y no vuelve a salir al recargar) */
  const idRespuesta = ultimaRespuesta?.id ?? null
  const [avisoVisto, setAvisoVisto] = useState<string | null>(null)
  const yaVisto = idRespuesta !== null && (idRespuesta === avisoVisto || avisosVistos().includes(idRespuesta))
  useEffect(() => {
    if (idRespuesta === null || avisosVistos().includes(idRespuesta)) return
    const temporizador = setTimeout(() => {
      marcarAvisoVisto(idRespuesta)
      setAvisoVisto(idRespuesta)
    }, 6000)
    return () => clearTimeout(temporizador)
  }, [idRespuesta])

  /* Abre o cierra el formulario; al abrir parte con los datos actuales */
  const alternar = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (!abierto) {
      setDatos(datosDe(mascota))
      setErrorRaza(null)
      setErrorGeneral(null)
    }
    setAbierto(!abierto)
  }
    /* Cierra el formulario sin guardar nada */
  const cancelar = () => {
    setAbierto(false)
    setErrorRaza(null)
    setErrorGeneral(null)
  }

  /* Foto elegida: se recorta y reduce a texto (base64) para guardarla */
  const subirFoto = async (archivo: File | undefined) => {
    if (!archivo) return
    const error = validarArchivoAvatar(archivo)
    if (error) return setErrorGeneral(error)
    try {
      const imagen = await redimensionarImagen(archivo, 300)
      setDatos((prev) => ({ ...prev, imagen }))
      setErrorGeneral(null)
    } catch {
      setErrorGeneral('No se pudo procesar la imagen.')
    }
  }

  /* Al guardar: se envía la solicitud a mascota-service */
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    const resultado = await enviarCambiosMascota(id, {
      ...datos,
      raza: datos.raza.trim(),
      peso: datos.peso.trim(),
      descripcion: datos.descripcion.trim(),
    })
    setEnviando(false)

    /* Si el servicio rechaza los datos, se muestra el error junto al campo que corresponde */
    if (!resultado.ok) {
      if (resultado.campo === 'raza') setErrorRaza(resultado.mensaje)
      else setErrorGeneral(resultado.mensaje)
      return
    }

    /* Todo bien: se guarda la solicitud nueva, se cierra el formulario y se avisa a la página */
    setSolicitudes((prev) => [resultado.dato, ...prev])
    setAbierto(false)
    onGuardado()
  }

  return (
    <>
      {/* Aviso de guardado y respuesta del administrador, solo al dueño. */}
        {!pendiente && ultimaRespuesta && !yaVisto && (
        <p
          className={`alerta-mascota ${ultimaRespuesta.estado === 'aprobada' ? 'alerta-mascota--info' : ''}`}
          role="status"
        >
          {aplicadaAlTiro(ultimaRespuesta)
            ? `✅ Datos de ${mascota.nombre} guardados. La ficha ya está actualizada.`
            : ultimaRespuesta.estado === 'aprobada'
            ? `✅ Administración aprobó los cambios de ${mascota.nombre}. La ficha ya está actualizada.`
            : `❌ Administración rechazó los cambios de ${mascota.nombre}. Puedes volver a editarlos.`}
        </p>
      )}

      {/* Aviso y botones según el estado de la ficha */}
      <div className="mascota-acciones">
        {pendiente ? (
          <p className="alerta-mascota alerta-mascota--info" role="status">
            🕒 Solicitud enviada para {mascota.nombre}, pendiente de aprobación.
          </p>
        ) : (
          <>
            {!mascota.completo && <p className="alerta-mascota">⚠️ Datos incompletos.</p>}
            <a href="#" className="enlace-completar" onClick={alternar}>
              Editar
            </a>
            {/* Cancelar solo aparece con el formulario abierto */}
            {abierto && (
              <button type="button" className="boton-cancelar-mascota" onClick={cancelar}>
                Cancelar
              </button>
            )}
          </>
        )}
      </div>

      {/* Formulario desplegable (no se muestra mientras haya una solicitud pendiente) */}
      {abierto && !pendiente && (
        <form className="formulario-mascota" onSubmit={enviar} noValidate>
          {/* Raza (obligatoria) */}
          <div className={`campo ${errorRaza ? 'campo--invalido' : ''}`.trim()}>
            <label htmlFor={`raza-${id}`}>Raza</label>
            <input
              id={`raza-${id}`}
              type="text"
              maxLength={40}
              value={datos.raza}
              onChange={(e) => {
                setDatos((prev) => ({ ...prev, raza: e.target.value }))
                setErrorRaza(null)
              }}
            />
            <MensajeError mensaje={errorRaza} id={`raza-${id}-error`} />
          </div>

          {/* Sexo y peso */}
          <div className="fila-campos">
            <div className="campo">
              <label htmlFor={`sexo-${id}`}>Sexo</label>
              <select
                id={`sexo-${id}`}
                value={datos.sexo}
                onChange={(e) => setDatos((prev) => ({ ...prev, sexo: e.target.value as Sexo }))}
              >
                <option value="">Selecciona</option>
                <option value="Macho">Macho</option>
                <option value="Hembra">Hembra</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor={`peso-${id}`}>Peso</label>
              <input
                id={`peso-${id}`}
                type="text"
                maxLength={20}
                placeholder="Ej: 4 kg"
                value={datos.peso}
                onChange={(e) => setDatos((prev) => ({ ...prev, peso: e.target.value }))}
              />
            </div>
          </div>

          {/* Foto: el botón abre el selector de archivos (el input va oculto) */}
          <div className="campo">
            <label>Foto de la mascota (opcional)</label>
            <div className="mascota-foto-upload">
              {/* Vista previa: solo aparece si ya hay foto */}
              {datos.imagen && <img src={datos.imagen} alt={`Foto de ${mascota.nombre}`} className="mascota-foto-preview" />}
              <button type="button" className="boton-subir-foto" onClick={() => inputArchivo.current?.click()}>
                Subir foto
              </button>
              <input
                ref={inputArchivo}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => subirFoto(e.target.files?.[0])}
              />
            </div>
          </div>

          {/* Descripción (opcional) */}
          <div className="campo">
            <label htmlFor={`descripcion-${id}`}>Descripción (opcional)</label>
            <input
              id={`descripcion-${id}`}
              type="text"
              maxLength={300}
              value={datos.descripcion}
              onChange={(e) => setDatos((prev) => ({ ...prev, descripcion: e.target.value }))}
            />
          </div>

          {/* Error general (foto muy pesada, mascota inexistente, etc.) */}
          <div className={errorGeneral ? 'campo campo--invalido' : undefined}>
            <MensajeError mensaje={errorGeneral} id={`mascota-${id}-error`} />
          </div>

          {/* Guardar los cambios */}
          <Boton type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </form>
      )}
    </>
  )
}