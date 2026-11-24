/* =========================================================
   PATITAS FELICES - SOLICITAR CITA 

   FUNCIONALIDADES:
   - Servicios filtrados por especie y veterinario.
   - Validación de días de atención de cada médico.
   - Bloqueo de horas ocupadas y citas superpuestas.
   - Precio y duración de los servicios.
   - Aviso de pago presencial después de enviar.
========================================================= */

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import {registrarMascotaDesdeCita} from '../../services/registroMascotaCitaService'
import { listarMascotasPorDueno } from '../../services/mascotasService'



import { useAuth } from '../../context/AuthContext'


import {
  fechaLocalHoy,
  HORARIOS_CITAS
} from '../../services/citasService'

import {
  solicitarCitaApi
} from '../../services/citasApiService'

import {
  ApiError,
  mensajeDeError
} from '../../services/api'

import {
  agruparServiciosCita,
  obtenerEspecieCita,
  obtenerServicioCita,
  profesionalPorConfirmar,
  formatearPrecioCLP,
  formatearDuracionServicio
} from '../../services/catalogoCitasService'

import SelectorVeterinarioCita from './SelectorVeterinarioCita'

import {
  consultarVeterinariosApi,
} from '../../services/veterinariosService'

/**
 * Consulta los veterinarios registrados en MySQL
 * mediante veterinario-service (puerto 8085).
 */


import type { Veterinario } from '../../types/veterinario'


/* =========================================================
   1. TIPOS DE DATOS
========================================================= */

type OtraEspecie = '' | 'Ave' | 'Conejo'
type UnidadEdad = 'meses' | 'anios'

interface DatosCita {
  nombreDueno: string
  correo: string
  telefono: string

  nombreMascota: string
  edadMascota: string
  unidadEdad: UnidadEdad

  tipoMascota: string
  otraEspecie: OtraEspecie

  servicio: string
  veterinarioId: number | null

  fecha: string
  hora: string
  motivo: string

  confirmarDatos: boolean
}

type Campo = keyof DatosCita

type ErroresCita =
  Partial<Record<Campo, string>>


/* =========================================================
   2. CAMPOS QUE DEBEMOS VALIDAR
========================================================= */

const CAMPOS: Campo[] = [
  'nombreDueno',
  'correo',
  'telefono',
  'nombreMascota',
  'edadMascota',
  'unidadEdad',
  'tipoMascota',
  'otraEspecie',
  'servicio',
  'veterinarioId',
  'fecha',
  'hora',
  'motivo',
  'confirmarDatos'
]


/* =========================================================
   3. OPCIONES DE MASCOTAS
========================================================= */

const MASCOTAS = [
  {
    valor: 'Perro',
    titulo: 'Perro',
    detalle: 'Nuestro mejor amigo',
    imagen: 'icono-perro.png'
  },
  {
    valor: 'Gato',
    titulo: 'Gato',
    detalle: 'Curioso y especial',
    imagen: 'icono-gato.png'
  },
  {
    valor: 'Otro',
    titulo: 'Otro',
    detalle: 'Otra mascota',
    imagen: 'icono-otro.png'
  }
]


/* =========================================================
   4. DÍAS DE LA SEMANA Y NOMBRES VÁLIDOS
========================================================= */

const DIAS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado'
]

const NOMBRE_VALIDO =
  /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/


/* =========================================================
   5. VALIDAR FORMATO DE FECHA

   Se usa la fecha local para evitar
   problemas con la zona horaria.
========================================================= */

function convertirFecha(
  fecha: string
): Date | null {

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return null
  }

  const [anio, mes, dia] =
    fecha.split('-').map(Number)

  const objeto = new Date(
    anio,
    mes - 1,
    dia
  )

  return (
    objeto.getFullYear() === anio &&
    objeto.getMonth() === mes - 1 &&
    objeto.getDate() === dia
  )
    ? objeto
    : null
}


/* =========================================================
   6. COMPROBAR DÍA DEL VETERINARIO
========================================================= */

function atiendeDia(
  medico: Veterinario | null,
  fecha: string
): boolean {

  const dia = convertirFecha(fecha)

  return Boolean(
    medico &&
    dia &&
    medico.dias.includes(
      DIAS[dia.getDay()]
    )
  )
}


/* =========================================================
   7. COMPROBAR HORARIO DEL VETERINARIO
========================================================= */

function atiendeHora(
  medico: Veterinario | null,
  hora: string
): boolean {

  if (!medico || !hora) {
    return false
  }

  const rango = medico.horario.match(
    /^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/
  )

  return Boolean(
    rango &&
    hora >= rango[1] &&
    hora < rango[2]
  )
}


/* =========================================================
   8. EVITAR CITAS EN HORAS PASADAS
========================================================= */

function esFutura(
  fecha: string,
  hora: string
): boolean {

  if (!fecha || !hora) {
    return false
  }

  if (fecha !== fechaLocalHoy()) {
    return fecha > fechaLocalHoy()
  }

  const ahora = new Date()

  const [h, m] =
    hora.split(':').map(Number)

  return (
    h * 60 + m >
    ahora.getHours() * 60 +
    ahora.getMinutes()
  )
}


/* =========================================================
   9. VALIDAR TODOS LOS CAMPOS DEL FORMULARIO
========================================================= */


/**
 * Valida los campos utilizando los veterinarios
 * reales obtenidos desde MySQL.
 *
 * @param campo Campo que se está validando.
 * @param datos Información ingresada en el formulario.
 * @param ocupadas Horarios registrados localmente;
 *                 su consulta se migrará al backend.
 * @param veterinariosApi Profesionales de MySQL.
 */
function validar(
  campo: Campo,
  datos: DatosCita,
  ocupadas: string[],
  veterinariosApi: Veterinario[]
): string {

  const especie = obtenerEspecieCita(
    datos.tipoMascota,
    datos.otraEspecie
  )

  
/* Buscar al veterinario por su ID real de MySQL. */

const medico =
  datos.veterinarioId == null
    ? null
    : veterinariosApi.find(
        (veterinario) =>
          veterinario.id === datos.veterinarioId
      ) ?? null


  switch (campo) {

    /* Nombre del dueño */

    case 'nombreDueno': {

      const nombre =
        datos.nombreDueno.trim()

      if (
        nombre.length < 3 ||
        nombre.length > 60
      ) {
        return 'Ingresa tu nombre entre 3 y 60 caracteres.'
      }

      return NOMBRE_VALIDO.test(nombre)
        ? ''
        : 'El nombre solo puede contener letras y espacios.'
    }


    /* Correo electrónico */

    case 'correo':

      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        datos.correo.trim()
      )
        ? ''
        : 'Ingresa un correo válido.'


    /* Teléfono celular chileno */

    case 'telefono':

      return /^(?:\+?56)?9\d{8}$/.test(
        datos.telefono.replace(/[\s-]/g, '')
      )
        ? ''
        : 'Ingresa un celular chileno válido. Ej.: +56 9 1234 5678.'


    /* Nombre de la mascota */

    case 'nombreMascota': {

      const nombre =
        datos.nombreMascota.trim()

      if (
        nombre.length < 2 ||
        nombre.length > 40
      ) {
        return 'El nombre de la mascota debe tener entre 2 y 40 caracteres.'
      }

      return NOMBRE_VALIDO.test(nombre)
        ? ''
        : 'El nombre de la mascota debe contener letras, no números.'
    }


    /* Unidad de edad */

    case 'unidadEdad':

      return ['meses', 'anios'].includes(
        datos.unidadEdad
      )
        ? ''
        : 'Elige meses o años.'


    /* Edad de la mascota */

    case 'edadMascota': {

      const edad =
        Number(datos.edadMascota)

      if (!datos.edadMascota.trim()) {
        return 'Ingresa la edad de tu mascota.'
      }

      if (!Number.isInteger(edad)) {
        return 'La edad debe ser un número entero.'
      }

      if (datos.unidadEdad === 'meses') {

        return edad >= 1 && edad <= 11
          ? ''
          : 'Ingresa entre 1 y 11 meses.'
      }

      return edad >= 1 && edad <= 30
        ? ''
        : 'Ingresa entre 1 y 30 años.'
    }


    /* Tipo de mascota */

    case 'tipoMascota':

      return [
        'Perro',
        'Gato',
        'Otro'
      ].includes(datos.tipoMascota)
        ? ''
        : 'Selecciona el tipo de mascota.'


    /* Ave o conejo */

    case 'otraEspecie':

      return (
        datos.tipoMascota !== 'Otro' ||
        ['Ave', 'Conejo'].includes(
          datos.otraEspecie
        )
      )
        ? ''
        : 'Selecciona Ave o Conejo.'


    /* Servicio compatible con la mascota */

    case 'servicio': {

      if (!especie) {
        return 'Primero selecciona la especie de tu mascota.'
      }

      const servicio =
        obtenerServicioCita(datos.servicio)

      if (!servicio) {
        return 'Selecciona un servicio veterinario.'
      }

      return servicio.especies.includes(especie)
        ? ''
        : 'Ese servicio no corresponde a tu mascota.'
    }


    /* Veterinario compatible */

    
/* =====================================================
   VETERINARIO SELECCIONADO

   Comprueba:
   - Que el profesional exista en MySQL.
   - Que sea médico veterinario.
   - Que atienda la especie seleccionada.
   - Que trabaje en la fecha elegida.

   La disponibilidad y las reglas definitivas
   de reserva las valida cita-service.
===================================================== */

case 'veterinarioId': {

  if (
    !medico ||
    datos.veterinarioId == null
  ) {
    return 'Selecciona un veterinario.'
  }

  if (medico.cargo !== 'Médico veterinario') {
    return 'Selecciona un médico veterinario.'
  }

 
/* =====================================================
   VALIDAR ESPECIE DEL VETERINARIO

   El formulario usa: Perro, Gato, Ave, Conejo.
   MySQL usa: Perros, Gatos, Aves, Conejos.

   Normalizamos los nombres para compararlos.
===================================================== */

if (
  !especie ||
  !medico.especies.some(
    (especieAtendida) =>
      especieAtendida.toLowerCase().replace(/s$/, '') ===
      especie.toLowerCase()
  )
) {
  return 'Este veterinario no atiende la especie seleccionada.'
}


  if (
    datos.fecha &&
    !atiendeDia(medico, datos.fecha)
  ) {
    return `${medico.nombre} no atiende ese día.`
  }

  return ''
}



    /* Fecha según días de atención */

    case 'fecha': {

      const fecha =
        convertirFecha(datos.fecha)

      if (!fecha) {
        return 'Selecciona una fecha válida.'
      }

      if (
        datos.fecha < fechaLocalHoy()
      ) {
        return 'No puedes solicitar una fecha anterior a hoy.'
      }

      if (
        [0, 6].includes(
          fecha.getDay()
        )
      ) {
        return 'Selecciona un día de lunes a viernes.'
      }

      if (!medico) {
        return 'Primero selecciona un veterinario.'
      }

      return atiendeDia(
        medico,
        datos.fecha
      )
        ? ''
        : `${medico.nombre} no atiende ese día.`
    }


    /* Hora disponible del veterinario */

    case 'hora': {

      if (
        !datos.hora ||
        !HORARIOS_CITAS.some(
          (hora) => hora === datos.hora
        )
      ) {
        return 'Selecciona una hora válida.'
      }

      if (
        !medico ||
        !atiendeDia(
          medico,
          datos.fecha
        ) ||
        !atiendeHora(
          medico,
          datos.hora
        )
      ) {
        return 'El veterinario no atiende en ese día y horario.'
      }

      if (
        !esFutura(
          datos.fecha,
          datos.hora
        )
      ) {
        return 'Selecciona una hora futura.'
      }

      if (
        ocupadas.includes(
          datos.hora
        )
      ) {
        return 'Ese horario ya está ocupado para este veterinario.'
      }

      return ''
    }


    /* Motivo de la consulta */

    case 'motivo': {

      const motivo =
        datos.motivo.trim()

      if (motivo.length < 10) {
        return 'Explica el motivo en al menos 10 caracteres.'
      }

      if (motivo.length > 500) {
        return 'El motivo no puede superar los 500 caracteres.'
      }

      return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(
        motivo
      )
        ? ''
        : 'Escribe una explicación con palabras, no solo símbolos.'
    }


    /* Confirmación de los datos */

    case 'confirmarDatos':

      return datos.confirmarDatos
        ? ''
        : 'Confirma que los datos son correctos.'
  }
}


/* =========================================================
   10. HORA ELEGIDA DESDE LA AGENDA DEL MÉDICO
========================================================= */

interface PreferenciaAgenda {
  veterinarioId: number
  fecha: string
  hora: string
}

function leerPreferencia(
  parametros: URLSearchParams
): PreferenciaAgenda | null {

  const veterinarioId =
    Number(parametros.get('veterinario'))

  const fecha =
    parametros.get('fecha') ?? ''

  const hora =
    parametros.get('hora') ?? ''

  if (
    !Number.isInteger(veterinarioId) ||
    veterinarioId <= 0 ||
    !convertirFecha(fecha) ||
    fecha < fechaLocalHoy() ||
    !HORARIOS_CITAS.some(
      (opcion) => opcion === hora
    )
  ) {
    return null
  }

  return {
    veterinarioId,
    fecha,
    hora
  }
}


/* Mostrar fecha de manera legible. */

function fechaLarga(
  fecha: string
): string {

  const objeto =
    convertirFecha(fecha)

  return objeto
    ? objeto.toLocaleDateString(
        'es-CL',
        {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        }
      )
    : fecha
}

/* Recuperar la edad de una mascota registrada.
   Admite valores como "3 años" y "8 meses". */

function leerEdadRegistrada(
  edad: string
): { cantidad: string; unidad: UnidadEdad } | null {

  const resultado = edad.trim().match(
    /^(\d+)\s*(mes(?:es)?|a(?:ño|ños|no|nos))?$/i
  )

  if (!resultado) return null

  const cantidad = Number(resultado[1])

  const unidad: UnidadEdad =
    resultado[2]?.toLowerCase().startsWith('mes')
      ? 'meses'
      : 'anios'

  if (unidad === 'meses' && (cantidad < 1 || cantidad > 11)) {
    return null
  }

  if (unidad === 'anios' && (cantidad < 1 || cantidad > 30)) {
    return null
  }

  return {
    cantidad: String(cantidad),
    unidad
  }
}


/* =========================================================
   11. COMPONENTE PRINCIPAL
========================================================= */

export default function FormularioSolicitarCita() {

  const { usuario } = useAuth()

  const formularioRef =
    useRef<HTMLFormElement>(null)

  /* Referencia para desplazarnos al mensaje de éxito. */

  const mensajeExitoRef =
    useRef<HTMLDivElement>(null)

  /* Preferencia de fecha y hora desde la agenda. */

  const [parametros] = useSearchParams()

  const [preferencia, setPreferencia] =
    useState<PreferenciaAgenda | null>(
      () => leerPreferencia(parametros)
    )


  /* =====================================================
     12. DATOS INICIALES DEL FORMULARIO
  ===================================================== */

  const [datos, setDatos] =
    useState<DatosCita>(() => ({

      nombreDueno:
        `${usuario?.nombre ?? ''} ${usuario?.apellidos ?? ''}`.trim(),

      correo: usuario?.correo ?? '',
      telefono: usuario?.telefono ?? '',

      nombreMascota: '',
      edadMascota: '',
      unidadEdad: 'anios',

      tipoMascota: '',
      otraEspecie: '',

      servicio: '',
      veterinarioId: null,

      fecha: '',
      hora: '',
      motivo: '',

      confirmarDatos: false
    }))


  /* Errores, validaciones y confirmación. */

  const [errores, setErrores] =
    useState<ErroresCita>({})

  const [visitados, setVisitados] =
    useState<Campo[]>([])

  const [enviada, setEnviada] =
    useState(false)

  const [errorGeneral, setErrorGeneral] =
    useState('')
  
const [enviando, setEnviando] =
  useState(false)


/* =====================================================
   VETERINARIOS REGISTRADOS EN MYSQL

   Consultamos los profesionales reales mediante
   veterinario-service, puerto 8085.

   Estos datos reemplazarán progresivamente
   a los profesionales simulados del frontend.
===================================================== */

const [veterinariosApi, setVeterinariosApi] =
  useState<Veterinario[]>([])

const [cargandoVeterinarios, setCargandoVeterinarios] =
  useState(true)

const [errorVeterinarios, setErrorVeterinarios] =
  useState('')

useEffect(() => {

  let activo = true

  async function cargarVeterinarios() {

    try {

      const profesionales =
        await consultarVeterinariosApi()

      if (!activo) return

      setVeterinariosApi(profesionales)
      setErrorVeterinarios('')

    } catch {

      if (!activo) return

      setVeterinariosApi([])

      setErrorVeterinarios(
        'No se pudo cargar el equipo veterinario. ' +
        'Comprueba que veterinario-service esté encendido.'
      )

    } finally {

      if (activo) {
        setCargandoVeterinarios(false)
      }

    }
  }

  void cargarVeterinarios()

  return () => {
    activo = false
  }

}, [])



/* =========================================
   MASCOTAS REGISTRADAS DEL USUARIO
========================================= */

const mascotasRegistradas = usuario
  ? listarMascotasPorDueno(usuario.correo)
  : []

const [modoReserva, setModoReserva] =
  useState<'nueva' | 'registrada'>('nueva')

const [mascotaSeleccionadaId, setMascotaSeleccionadaId] =
  useState('')

const mascotaSeleccionada =
  mascotasRegistradas.find(
    (mascota) => mascota.id === mascotaSeleccionadaId
  ) ?? null


/* Alternar entre mascota nueva y registrada. */

function cambiarModoReserva(
  modo: 'nueva' | 'registrada'
) {

  if (enviada || modo === modoReserva) return

  setModoReserva(modo)
  setMascotaSeleccionadaId('')
  setPreferencia(null)
  setErrores({})
  setVisitados([])
  setErrorGeneral('')

  setDatos({
    nombreDueno:
      `${usuario?.nombre ?? ''} ${usuario?.apellidos ?? ''}`.trim(),

    correo: usuario?.correo ?? '',
    telefono: usuario?.telefono ?? '',

    nombreMascota: '',
    edadMascota: '',
    unidadEdad: 'anios',

    tipoMascota: '',
    otraEspecie: '',

    servicio: '',
    veterinarioId: null,

    fecha: '',
    hora: '',
    motivo: '',
    confirmarDatos: false
  })
}


/* Recuperar los datos al seleccionar una mascota. */

function elegirMascotaRegistrada(idMascota: string) {

  if (enviada) return

  const seleccionada = mascotasRegistradas.find(
    (mascota) => mascota.id === idMascota
  )

  setMascotaSeleccionadaId(idMascota)
  setErrores({})
  setVisitados([])
  setErrorGeneral('')

  const edad = seleccionada
    ? leerEdadRegistrada(seleccionada.edad)
    : null

  const especieRegistrada = seleccionada?.especie

  setDatos({
    nombreDueno:
      `${usuario?.nombre ?? ''} ${usuario?.apellidos ?? ''}`.trim(),

    correo: usuario?.correo ?? '',
    telefono: usuario?.telefono ?? '',

    nombreMascota: seleccionada?.nombre ?? '',
    edadMascota: edad?.cantidad ?? '',
    unidadEdad: edad?.unidad ?? 'anios',

    tipoMascota:
      especieRegistrada === 'Perro' ||
      especieRegistrada === 'Gato'
        ? especieRegistrada
        : especieRegistrada
          ? 'Otro'
          : '',

    otraEspecie:
      especieRegistrada === 'Ave' ||
      especieRegistrada === 'Conejo'
        ? especieRegistrada
        : '',

    servicio: '',
    veterinarioId: null,

    fecha: '',
    hora: '',
    motivo: '',
    confirmarDatos: false
  })
}

  /* =====================================================
     13. MOSTRAR EL MENSAJE DE PAGO AL ENVIAR

     Cuando crearCita() guarda exitosamente,
     se activa enviada y mostramos el aviso.
  ===================================================== */

  useEffect(() => {

    if (enviada) {

      mensajeExitoRef.current
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
    }

  }, [enviada])


  /* =====================================================
     14. COMPLETAR DATOS DEL USUARIO
  ===================================================== */

  useEffect(() => {

    if (!usuario) {
      return
    }

    setDatos((anterior) => ({

      ...anterior,

      nombreDueno:
        anterior.nombreDueno ||
        `${usuario.nombre} ${usuario.apellidos}`.trim(),

      correo:
        anterior.correo ||
        usuario.correo,

      telefono:
        anterior.telefono ||
        usuario.telefono

    }))

  }, [usuario])


  /* =====================================================
     15. CONSULTAR ESPECIE Y SERVICIOS
  ===================================================== */

  const especie =
    obtenerEspecieCita(
      datos.tipoMascota,
      datos.otraEspecie
    )

  const gruposServicio =
    agruparServiciosCita(especie)

  /* Cuando hay una hora elegida desde la agenda,
     filtramos los servicios de ese médico. */

  // Los servicios se filtran por especie; no cruzamos IDs reales con el catálogo simulado.
  const serviciosVisibles = gruposServicio

  /* Servicio con sus datos, precio y duración. */

  const servicioActual =
    obtenerServicioCita(
      datos.servicio
    )

  const confirmarProfesional =
    profesionalPorConfirmar(
      datos.servicio
    )


  /* =====================================================
     16. OBTENER VETERINARIO Y HORAS OCUPADAS
  ===================================================== */

/* =====================================================
   VETERINARIO SELECCIONADO DESDE MYSQL

   Busca al profesional por su ID real,
   utilizando la lista obtenida de Spring Boot.

   Esto evita confundir a Camila González (ID 2)
   con los veterinarios simulados.
===================================================== */

const medico =
  datos.veterinarioId == null
    ? null
    : veterinariosApi.find(
        (veterinario) =>
          veterinario.id === datos.veterinarioId
      ) ?? null


  
// La ocupación confirmada debe obtenerse de cita-service; la API actual
// no publica disponibilidad. De momento solo se ofrecen horas de jornada.
const ocupadas: string[] = []

/* =========================================
   HORARIOS PARA MASCOTAS REGISTRADAS

   Buscar profesionales compatibles y horas
   libres sin superposiciones.
========================================= */

/* =====================================================
   FECHAS DE ATENCIÓN DISPONIBLES PARA SELECCIONAR

   Generamos fechas de los próximos 60 días.

   Solamente mostramos fechas cuando:
   - El veterinario trabaja ese día.
   - Existe al menos un horario futuro.
   - La fecha corresponde a su jornada.

   Para mascotas registradas conservamos
   los profesionales asignables del formulario.
===================================================== */


/* =========================================
   VETERINARIOS REALES DE MYSQL
========================================= */

const medicosCompatibles =
  modoReserva === 'registrada' && especie && datos.servicio
    ? veterinariosApi.filter(
        (veterinario) =>
          veterinario.cargo === 'Médico veterinario' &&
          veterinario.especies.some(
            (especieAtendida) =>
              especieAtendida.toLowerCase().replace(/s$/, '') ===
              especie.toLowerCase()
          )
      )
    : []

/* =========================================
   PROFESIONALES SEGÚN TIPO DE RESERVA
========================================= */

const profesionalesParaFecha =
  modoReserva === 'registrada'
    ? medicosCompatibles
    : medico
      ? [medico]
      : []

/* =========================================
   FECHAS SEGÚN DÍAS DE ATENCIÓN
========================================= */

const fechasParaElegir = Array.from(
  { length: 60 },
  (_, indice) => {
    const fecha = new Date()
    fecha.setHours(0, 0, 0, 0)
    fecha.setDate(fecha.getDate() + indice)

    const valor = [
      fecha.getFullYear(),
      String(fecha.getMonth() + 1).padStart(2, '0'),
      String(fecha.getDate()).padStart(2, '0')
    ].join('-')

    const etiqueta = fecha.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    return { valor, etiqueta }
  }
).filter(({ valor }) =>
  profesionalesParaFecha.some(
    (veterinario) =>
      atiendeDia(veterinario, valor) &&
      HORARIOS_CITAS.some(
        (hora) =>
          atiendeHora(veterinario, hora) &&
          esFutura(valor, hora)
      )
  )
)


/* =========================================
   HORAS PARA MASCOTAS REGISTRADAS

   Filtrar según:
   - Día de atención del veterinario
   - Horario de trabajo
   - Hora futura
   - Reservas registradas localmente
========================================= */

const horasDisponiblesRegistrada =
  modoReserva === 'registrada' && datos.fecha
    ? HORARIOS_CITAS.filter((hora) =>
        esFutura(datos.fecha, hora) &&
        medicosCompatibles.some((veterinario) =>
          atiendeDia(veterinario, datos.fecha) &&
          atiendeHora(veterinario, hora)
        )
      )
    : []

/* =====================================================
     17. ACTUALIZAR DATOS Y REVALIDAR
  ===================================================== */

  function actualizar(
    nuevos: DatosCita
  ) {

    setDatos(nuevos)

    setErrorGeneral('')

    
      const nuevasOcupadas: string[] = []

    setErrores((anterior) => {

      const resultado = {
        ...anterior
      }

      for (const campo of visitados) {

        
      resultado[campo] = validar(
        campo,
        nuevos,
        nuevasOcupadas,
        veterinariosApi
      )

      }

      return resultado
    })
  }


  /* =====================================================
     18. APLICAR HORA ELEGIDA DESDE AGENDA
  ===================================================== */

  function aplicarPreferencia(
    nuevos: DatosCita
  ) {

    actualizar(nuevos)

    const camposAgenda: Campo[] = [
      'veterinarioId',
      'fecha',
      'hora'
    ]

     
    const ocupadasAgenda: string[] = []

    setVisitados((anteriores) => [

      ...anteriores,

      ...camposAgenda.filter(
        (campo) =>
          !anteriores.includes(campo)
      )

    ])

    setErrores((anteriores) => {

      const resultado = {
        ...anteriores
      }

      for (const campo of camposAgenda) {

        resultado[campo] = validar(
          campo,
          nuevos,
          ocupadasAgenda,
          veterinariosApi
        )
      }

      return resultado
    })
  }


  /* =====================================================
     19. MANEJAR CAMBIOS DEL FORMULARIO
  ===================================================== */

  function manejarCambio(
    evento: ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >
  ) {

    if (enviada) {
      return
    }

    const campo =
      evento.target.name as Campo

    const valor =
      evento.target instanceof HTMLInputElement &&
      evento.target.type === 'checkbox'

        ? evento.target.checked

        : evento.target.value

    const nuevos = {
      ...datos,
      [campo]: valor
    } as DatosCita


    /* Si cambia la mascota, limpiar selección previa. */

    if (
      campo === 'tipoMascota' ||
      campo === 'otraEspecie'
    ) {

      if (campo === 'tipoMascota') {
        nuevos.otraEspecie = ''
      }

      nuevos.servicio = ''
      nuevos.veterinarioId = null
      nuevos.fecha = ''
      nuevos.hora = ''
    }


    /* Si cambia el servicio, seleccionar nuevamente
       al médico y el horario correspondiente. */

    if (campo === 'servicio') {

      nuevos.veterinarioId = null
      nuevos.fecha = ''
      nuevos.hora = ''

      if (
        preferencia &&
        veterinariosApi.some((vet) =>
          vet.id === preferencia.veterinarioId &&
          vet.cargo === 'Médico veterinario' &&
          vet.especies.some((e) =>
            e.toLowerCase().replace(/s$/, '') ===
            obtenerEspecieCita(nuevos.tipoMascota, nuevos.otraEspecie)?.toLowerCase()
          )
        )
      ) {

        nuevos.veterinarioId =
          preferencia.veterinarioId

        nuevos.fecha =
          preferencia.fecha

        nuevos.hora =
          preferencia.hora

        aplicarPreferencia(nuevos)

        return
      }
    }


    /* Cuando cambia la fecha, limpiar la hora. */

    if (campo === 'fecha') {
      nuevos.hora = ''
    }


    /* Evitar confundir meses con años. */

    if (campo === 'unidadEdad') {
      nuevos.edadMascota = ''
    }
    
/* =========================================
   ASIGNACIÓN AUTOMÁTICA DEL VETERINARIO
   SOLO PARA MASCOTAS REGISTRADAS
========================================= */

if (
  modoReserva === 'registrada' &&
  mascotaSeleccionada &&
  (
    campo === 'servicio' ||
    campo === 'fecha' ||
    campo === 'hora'
  )
) {

  const especieElegida = obtenerEspecieCita(
    nuevos.tipoMascota,
    nuevos.otraEspecie
  )

  
const compatibles = veterinariosApi.filter(
  (vet) =>
    vet.cargo === 'Médico veterinario' &&
    Boolean(especieElegida) &&
    vet.especies.some(
      (especieAtendida) =>
        especieAtendida.toLowerCase().replace(/s$/, '') ===
        especieElegida?.toLowerCase()
    )
)


  const medicosDelDia = nuevos.fecha
    ? compatibles.filter(
        (vet) => atiendeDia(vet, nuevos.fecha)
      )
    : compatibles

  
let elegido: Veterinario | undefined =
  medicosDelDia.find(
    (vet) => vet.id === datos.veterinarioId
  ) ?? medicosDelDia[0]

  if (campo === 'hora' && nuevos.hora) {

    elegido = medicosDelDia.find((vet) =>

      atiendeHora(vet, nuevos.hora) &&

      esFutura(nuevos.fecha, nuevos.hora) &&

     
     atiendeDia(vet, nuevos.fecha)


    )
  }

  nuevos.veterinarioId = elegido?.id ?? null
}


    actualizar(nuevos)
  }


  /* =====================================================
     20. INFORMACIÓN DE LA HORA PRESELECCIONADA
  ===================================================== */

  const medicoPreferido = preferencia
    ? veterinariosApi.find((v) => v.id === preferencia.veterinarioId) ?? null
    : null

  const medicoSinServicios = Boolean(
    preferencia &&
    especie &&
    medicoPreferido &&
    !medicoPreferido.especies.some((e) =>
      e.toLowerCase().replace(/s$/, '') === especie.toLowerCase()
    )
  )

  const preferenciaNoCalza = medicoSinServicios

  /* =====================================================
     21. SELECCIONAR VETERINARIO
  ===================================================== */

  function seleccionarVeterinario(
    id: number
  ) {

    if (enviada) {
      return
    }

    const nuevos: DatosCita = {

      ...datos,

      veterinarioId: id,

      fecha: '',

      hora: ''
    }

    actualizar(nuevos)

    setVisitados((anteriores) =>

      anteriores.includes('veterinarioId')

        ? anteriores

        : [...anteriores, 'veterinarioId']
    )

    setErrores((anteriores) => ({

      ...anteriores,

      
    veterinarioId: validar(
      'veterinarioId',
      nuevos,
      [],
      veterinariosApi
    )

    }))
  }


  /* =====================================================
     22. VALIDACIÓN AL SALIR DE UN CAMPO
  ===================================================== */

  function manejarSalida(
    campo: Campo
  ) {

    if (enviada) {
      return
    }

    setVisitados((anteriores) =>

      anteriores.includes(campo)

        ? anteriores

        : [...anteriores, campo]
    )

    setErrores((anteriores) => ({

      ...anteriores,

      [campo]: validar(
        campo,
        datos,
        ocupadas,
        veterinariosApi
      )
    }))
  }


  /* Mostrar mensaje de error bajo un campo. */

  function errorDe(
    campo: Campo
  ) {

    return errores[campo] ? (

      <small
        className="mensaje-error"
        role="alert"
      >
        {errores[campo]}
      </small>

    ) : null
  }


  /* =====================================================
     23. ENVIAR LA SOLICITUD DE CITA
     Comprueba los datos, veterinario y horario.
  ===================================================== */

  async function enviar(
    evento: FormEvent<HTMLFormElement>
  ) {

    evento.preventDefault()

    if (enviada || enviando) {
      return
    }

    if (!usuario) {

      setErrorGeneral(
        'Inicia sesión para solicitar una cita.'
      )

      return
    }
    
if (modoReserva === 'registrada' && !mascotaSeleccionada) {
  setErrorGeneral(
    'Selecciona tu mascota registrada para continuar.'
  )
  return
}

if (modoReserva === 'registrada' && !datos.telefono.trim()) {
  setErrorGeneral(
    'Agrega tu teléfono en Mi perfil antes de solicitar otra cita.'
  )
  return
}



    /* Consultar disponibilidad actualizada. */

    
     const actuales: string[] = []

    /* Validar todos los campos. */

    
const camposValidar =
  modoReserva === 'registrada'

    ? CAMPOS.filter((campo) =>
        ![
          'nombreDueno',
          'correo',
          'telefono',
          'nombreMascota',
          'tipoMascota',
          'otraEspecie'
        ].includes(campo)
      )

    : CAMPOS


    
const nuevosErrores: ErroresCita = {}

for (const campo of camposValidar) {

  const mensaje = validar(
    campo,
    datos,
    actuales,
    veterinariosApi
  )

  if (mensaje) {
    nuevosErrores[campo] = mensaje
  }
}


    setErrores(nuevosErrores)
    setVisitados(camposValidar)


    const primerError =
      camposValidar.find(
        (campo) =>
          Boolean(nuevosErrores[campo])
      )

    if (primerError) {

      setErrorGeneral(
        'Revisa los campos marcados antes de continuar.'
      )

      formularioRef.current
        ?.querySelector<HTMLElement>(
          `[name="${primerError}"]`
        )
        ?.focus()

      return
    }


    /* Debe existir un médico válido. */

    if (
      !medico ||
      datos.veterinarioId == null
    ) {

      setErrorGeneral(
        'Selecciona un médico compatible con el servicio.'
      )

      return
    }


    /* Convertir edad a años. */

    const edadEnAnios =
      datos.unidadEdad === 'meses'

        ? Number(datos.edadMascota) / 12

        : Number(datos.edadMascota)


    /* Guardar la solicitud de cita. */

    setEnviando(true)

    try {
      await solicitarCitaApi({
        dueno: datos.nombreDueno.trim(),
        propietario: datos.nombreDueno.trim(),
        correo: datos.correo.trim(),
        telefono: datos.telefono.trim(),
        mascota: datos.nombreMascota.trim(),
        tipoMascota: datos.tipoMascota,
        otraEspecie: datos.otraEspecie || null,
        edadMascota: edadEnAnios,
        veterinarioId: medico.id,
        servicio: datos.servicio,
        fecha: datos.fecha,
        hora: datos.hora,
        motivo: datos.motivo.trim(),
        duracionMinutos: servicioActual?.duracionMinutos,
      })
    } catch (error: unknown) {
      setErrorGeneral(mensajeDeError(error))
      if (error instanceof ApiError && error.campo && error.campo in datos) {
        const campo = error.campo as Campo
        setErrores((anterior) => ({
          ...anterior,
          [campo]: error.message,
        }))
      }
      return
    } finally {
      setEnviando(false)
    }

/* ==============================================
   COMPROBAR SI LA CITA SE GUARDÓ
============================================== */

/* ==============================================
   REGISTRAR TAMBIÉN LA MASCOTA

   Esto ocurre únicamente cuando la solicitud
   de cita se guardó correctamente.
============================================== */

let avisoMascota = ''

const especieRegistrada = obtenerEspecieCita(
  datos.tipoMascota,
  datos.otraEspecie
)

if (especieRegistrada && modoReserva === 'nueva') {

  try {

    registrarMascotaDesdeCita({

      nombre: datos.nombreMascota,

      especie: especieRegistrada,

      edad: `${datos.edadMascota} ${
        datos.unidadEdad === 'meses'
          ? 'meses'
          : 'años'
      }`,

      dueño: datos.nombreDueno,

      /* Vincular a la cuenta que inició sesión. */
      correoDueño: usuario.correo

    })

  } catch {

    /* La cita ya fue guardada, por lo que
       no debemos intentar enviarla nuevamente. */

    avisoMascota =
      'La cita quedó registrada, pero no se pudo guardar la ficha de la mascota.'

  }
}


/* ==============================================
   MOSTRAR CONFIRMACIÓN DE LA SOLICITUD
============================================== */

setErrores({})

setErrorGeneral(avisoMascota)

setEnviada(true)
  }

  /* =====================================================
     24. INTERFAZ DEL FORMULARIO
  ===================================================== */

  return (

    
<section
  className={`seccion-solicitar-cita ${
    modoReserva === 'registrada'
      ? 'cita-modo-registrada'
      : ''
  }`}
>


      <div className="contenedor">


        {/* =====================================
            ENCABEZADO DEL FORMULARIO
        ===================================== */}

        <div className="encabezado-formulario-cita">

          <span>Solicitud de atención</span>

          <h2>
            Cuéntanos sobre tu mascota
          </h2>

          <p>
            Completa los siguientes pasos
            para solicitar una cita.
          </p>

        </div>


        {/* =====================================
            INDICADOR DE PASOS
        ===================================== */}

        <div
          className="indicador-pasos"
          aria-label="Pasos de la solicitud"
        >

          <div className="paso-indicador">

            <span>1</span>

            <div>
              <strong>Tus datos</strong>
              <small>Información de contacto</small>
            </div>

          </div>

          <div className="linea-paso" />

          <div className="paso-indicador">

            <span className="paso-rosa">
              2
            </span>

            <div>
              <strong>Tu mascota</strong>
              <small>Cuéntanos sobre ella</small>
            </div>

          </div>

          <div className="linea-paso" />

          <div className="paso-indicador">

            <span className="paso-morado">
              3
            </span>

            <div>
              <strong>La cita</strong>
              <small>Fecha y atención</small>
            </div>

          </div>

        </div>


        {/* =====================================
            AVISO DE SESIÓN
        ===================================== */}

        <div className="aviso-sesion">

          <div
            className="aviso-sesion-icono"
            aria-hidden="true"
          >
            🔒
          </div>

          <div className="aviso-sesion-texto">

            <strong>
              Tu solicitud quedará vinculada a tu cuenta
            </strong>

            <p>
              Podrás consultar su estado desde «Mis citas».
            </p>

          </div>

          <span className="aviso-proximamente">
            Sesión activa
          </span>

        </div>


        {/* =====================================
            HORA ELEGIDA DESDE LA AGENDA
        ===================================== */}

        {preferencia && medicoPreferido && !enviada && (

          <div
            className={`cita-preseleccion ${
              preferenciaNoCalza || medicoSinServicios
                ? 'cita-preseleccion--aviso'
                : ''
            }`}
            role="status"
          >

            <strong>
              📅 Hora elegida: {medicoPreferido.nombre}
              {' · '}
              {fechaLarga(preferencia.fecha)}
              {' · '}
              {preferencia.hora} hrs
            </strong>

            <p>

              {medicoSinServicios

                ? `${medicoPreferido.nombre} no atiende a esta especie. Elige otra mascota o quita esta hora para ver a todos los profesionales.`

                : preferenciaNoCalza

                  ? `${medicoPreferido.nombre} no realiza el servicio elegido para esta especie. Elige otro profesional en el paso 3 o cambia el servicio.`

                  : `Completa tus datos y los de tu mascota. En el paso 3 verás solo los servicios que realiza ${medicoPreferido.nombre}.`
              }

            </p>

            <button
              type="button"
              className="btn btn-link btn-sm p-0 mt-1"
              onClick={() =>
                setPreferencia(null)
              }
            >
              Quitar esta hora y elegir otra
            </button>

          </div>

        )}


        {/* =====================================
            FORMULARIO PRINCIPAL
        ===================================== */}

        <form
          className="formulario-cita"
          ref={formularioRef}
          onSubmit={enviar}
          noValidate
        >
          
{/* =========================================
    ELEGIR MASCOTA NUEVA O REGISTRADA
========================================= */}

{mascotasRegistradas.length > 0 && !enviada && (

  <section className="cita-repetir-panel">

    <h3>🐾 ¿Para quién es esta cita?</h3>

    <p>
      Si tu mascota ya está registrada, no necesitas
      volver a escribir todos sus datos.
    </p>

    <div className="cita-repetir-opciones">

      <button
        type="button"
        className={`cita-repetir-opcion ${
          modoReserva === 'registrada' ? 'activa' : ''
        }`}
        onClick={() => cambiarModoReserva('registrada')}
      >
        🐶 Volver a sacar hora a mi mascota
      </button>

      <button
        type="button"
        className={`cita-repetir-opcion ${
          modoReserva === 'nueva' ? 'activa' : ''
        }`}
        onClick={() => cambiarModoReserva('nueva')}
      >
        ✨ Solicitar cita para mascota nueva
      </button>

    </div>

    {modoReserva === 'registrada' && (

      <div className="cita-repetir-seleccion">

        <label htmlFor="mascotaRegistrada">
          Selecciona tu mascota registrada *
        </label>

        <select
          id="mascotaRegistrada"
          value={mascotaSeleccionadaId}
          onChange={(e) =>
            elegirMascotaRegistrada(e.target.value)
          }
        >

          <option value="">
            Selecciona una mascota
          </option>

          {mascotasRegistradas.map((mascota) => (

            <option
              key={mascota.id}
              value={mascota.id}
            >
              {mascota.nombre} · {mascota.especie}
            </option>

          ))}

        </select>

        {mascotaSeleccionada && (

          <div className="cita-repetir-mascota">

            <img
              src={
                mascotaSeleccionada.imagen ||
                (
                  mascotaSeleccionada.especie === 'Perro'
                    ? '/img/icono-perro.png'
                    : mascotaSeleccionada.especie === 'Gato'
                      ? '/img/icono-gato.png'
                      : '/img/icono-otro.png'
                )
              }
              alt={mascotaSeleccionada.nombre}
            />

            <div>

              <strong>
                🐾 {mascotaSeleccionada.nombre}
              </strong>

              <p>
                {mascotaSeleccionada.especie}
                {' · '}
                {mascotaSeleccionada.edad || 'Edad no registrada'}
              </p>

              <small>
                ✓ Datos recuperados de tu cuenta
              </small>

            </div>

          </div>

        )}

        {/* Solo pedir la edad si falta o no es válida. */}

        {mascotaSeleccionada &&
          !leerEdadRegistrada(mascotaSeleccionada.edad) && (

          <div className="cita-repetir-edad">

            <p>
              Indica la edad de tu mascota para
              solicitar esta atención.
            </p>

            <input
              type="number"
              name="edadMascota"
              aria-label="Edad de la mascota"
              min={1}
              max={datos.unidadEdad === 'meses' ? 11 : 30}
              value={datos.edadMascota}
              onChange={manejarCambio}
              onBlur={() => manejarSalida('edadMascota')}
            />

            <select
              name="unidadEdad"
              aria-label="Unidad de edad"
              value={datos.unidadEdad}
              onChange={manejarCambio}
            >
              <option value="anios">Años</option>
              <option value="meses">Meses</option>
            </select>

            {errorDe('edadMascota')}

          </div>

        )}

      </div>

    )}

  </section>

)}



          {/* =================================
              PASO 1: DATOS DEL DUEÑO
          ================================= */}

          <section className="bloque-formulario bloque-celeste">

            <div className="titulo-bloque">

              <span className="numero-paso">
                1
              </span>

              <div>
                <h3>Datos del dueño</h3>
                <p>¿Con quién debemos comunicarnos?</p>
              </div>

            </div>


            <div className="grid-campos">


              {/* Nombre completo */}

              <div className="grupo-campo">

                <label htmlFor="nombreDueno">
                  Nombre completo *
                </label>

                <input
                  id="nombreDueno"
                  name="nombreDueno"
                  type="text"
                  maxLength={60}
                  autoComplete="name"
                  placeholder="Ej.: Camila González"
                  value={datos.nombreDueno}
                  onChange={manejarCambio}
                  onBlur={() =>
                    manejarSalida('nombreDueno')
                  }
                  aria-invalid={!!errores.nombreDueno}
                />

                {errorDe('nombreDueno')}

              </div>


              {/* Correo electrónico */}

              <div className="grupo-campo">

                <label htmlFor="correoCita">
                  Correo electrónico *
                </label>

                <input
                  id="correoCita"
                  name="correo"
                  type="email"
                  autoComplete="email"
                  placeholder="correo@ejemplo.cl"
                  value={datos.correo}
                  onChange={manejarCambio}
                  onBlur={() =>
                    manejarSalida('correo')
                  }
                  aria-invalid={!!errores.correo}
                />

                {errorDe('correo')}

              </div>


              {/* Teléfono */}

              <div className="grupo-campo">

                <label htmlFor="telefonoCita">
                  Teléfono *
                </label>

                <input
                  id="telefonoCita"
                  name="telefono"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+56 9 1234 5678"
                  value={datos.telefono}
                  onChange={manejarCambio}
                  onBlur={() =>
                    manejarSalida('telefono')
                  }
                  aria-invalid={!!errores.telefono}
                />

                {errorDe('telefono')}

              </div>

            </div>

          </section>


          {/* =================================
              PASO 2: DATOS DE LA MASCOTA
          ================================= */}

          <section className="bloque-formulario bloque-rosa">

            <div className="titulo-bloque">

              <span className="numero-paso numero-paso-rosa">
                2
              </span>

              <div>
                <h3>Datos de la mascota</h3>
                <p>Queremos conocer a tu compañero.</p>
              </div>

            </div>


            <div className="grid-mascota">


              {/* Nombre de la mascota */}

              <div className="grupo-campo">

                <label htmlFor="nombreMascota">
                  Nombre de la mascota *
                </label>

                <input
                  id="nombreMascota"
                  name="nombreMascota"
                  type="text"
                  minLength={2}
                  maxLength={40}
                  placeholder="Ej.: Luna"
                  value={datos.nombreMascota}
                  onChange={manejarCambio}
                  onBlur={() =>
                    manejarSalida('nombreMascota')
                  }
                  aria-invalid={!!errores.nombreMascota}
                />

                <small
                  style={{
                    color: '#6F6F78',
                    marginTop: '6px'
                  }}
                >
                  Entre 2 y 40 caracteres, sin números.
                </small>

                {errorDe('nombreMascota')}

              </div>


              {/* Edad de la mascota */}

              <div className="grupo-campo">

                <label htmlFor="edadMascota">
                  Edad aproximada *
                </label>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'minmax(0,1fr) minmax(105px,120px)',
                    gap: '10px'
                  }}
                >

                  <input
                    id="edadMascota"
                    name="edadMascota"
                    type="number"
                    min={1}
                    max={
                      datos.unidadEdad === 'meses'
                        ? 11
                        : 30
                    }
                    step={1}
                    placeholder="Ej.: 5"
                    value={datos.edadMascota}
                    onChange={manejarCambio}
                    onBlur={() =>
                      manejarSalida('edadMascota')
                    }
                    aria-invalid={!!errores.edadMascota}
                  />

                  <select
                    id="unidadEdadMascota"
                    name="unidadEdad"
                    aria-label="Unidad de edad"
                    value={datos.unidadEdad}
                    onChange={manejarCambio}
                  >

                    <option value="meses">
                      Meses
                    </option>

                    <option value="anios">
                      Años
                    </option>

                  </select>

                </div>

                <small
                  style={{
                    color: '#6F6F78',
                    marginTop: '6px'
                  }}
                >

                  {datos.unidadEdad === 'meses'
                    ? 'Entre 1 y 11 meses.'
                    : 'Entre 1 y 30 años.'}

                </small>

                {errorDe('edadMascota')}

              </div>

            </div>


            {/* =================================
                SELECCIÓN DE TIPO DE MASCOTA
            ================================= */}

            <div className="grupo-opciones">

              <div
                className="titulo-opciones"
                id="tipoMascotaTitulo"
              >
                Tipo de mascota *
              </div>

              <div
                className="opciones-mascota"
                role="radiogroup"
                aria-labelledby="tipoMascotaTitulo"
              >

                {MASCOTAS.map((mascota) => (

                  <label
                    className="tarjeta-opcion"
                    key={mascota.valor}
                  >

                    <input
                      type="radio"
                      name="tipoMascota"
                      value={mascota.valor}
                      checked={
                        datos.tipoMascota === mascota.valor
                      }
                      onChange={manejarCambio}
                      onBlur={() =>
                        manejarSalida('tipoMascota')
                      }
                    />

                    <div className="contenedor-icono-mascota">

                      <img
                        src={`/img/${mascota.imagen}`}
                        alt={mascota.titulo}
                        className="imagen-tipo-mascota"
                      />

                    </div>

                    <strong>
                      {mascota.titulo}
                    </strong>

                    <small>
                      {mascota.detalle}
                    </small>

                  </label>

                ))}

              </div>

              {errorDe('tipoMascota')}

            </div>


            {/* =================================
                OPCIÓN AVE O CONEJO
            ================================= */}

            {datos.tipoMascota === 'Otro' && (

              <div className="grupo-campo campo-otra-especie">

                <label htmlFor="otraEspecieCita">
                  ¿Qué tipo de mascota tienes? *
                </label>

                <select
                  id="otraEspecieCita"
                  name="otraEspecie"
                  value={datos.otraEspecie}
                  onChange={manejarCambio}
                  onBlur={() =>
                    manejarSalida('otraEspecie')
                  }
                  aria-invalid={!!errores.otraEspecie}
                >

                  <option value="">
                    Selecciona una especie
                  </option>

                  <option value="Ave">
                    Ave
                  </option>

                  <option value="Conejo">
                    Conejo
                  </option>

                </select>

                {errorDe('otraEspecie')}

              </div>

            )}

          </section>


          {/* =================================
              PASO 3: INFORMACIÓN DE LA CITA
          ================================= */}

          <section className="bloque-formulario bloque-morado">

            <div className="titulo-bloque">

              <span className="numero-paso numero-paso-morado">
                3
              </span>

              <div>

                <h3>Información de la cita</h3>

                <p>
                  Selecciona atención, profesional,
                  fecha y horario.
                </p>

              </div>

            </div>


            {/* =================================
                SERVICIOS SEGÚN LA ESPECIE
            ================================= */}

            <div className="grupo-opciones">

              <label
                htmlFor="servicioCita"
                className="titulo-opciones"
              >
                ¿Qué atención necesitas? *
              </label>

              <p className="ayuda-servicio-cita">
                Primero elige la especie de tu mascota.
                Solo aparecerán los servicios compatibles.
              </p>

              <div className="grupo-campo selector-servicio-cita">

                <select
                  id="servicioCita"
                  name="servicio"
                  value={datos.servicio}
                  onChange={manejarCambio}
                  onBlur={() =>
                    manejarSalida('servicio')
                  }
                  disabled={!especie}
                  aria-invalid={!!errores.servicio}
                >

                  <option value="">

                    {especie
                      ? 'Selecciona un servicio'
                      : 'Primero selecciona tu mascota'}

                  </option>


                  {/* =================================
                      SERVICIOS CON PRECIO Y DURACIÓN
                  ================================= */}

                  {Object.entries(serviciosVisibles).map(
                    ([grupo, servicios]) => (

                      <optgroup
                        key={grupo}
                        label={grupo}
                      >

                        {servicios.map((servicio) => (

                          <option
                            key={servicio.codigo}
                            value={servicio.nombre}
                          >

                            {servicio.nombre}

                            {' · '}

                            {formatearDuracionServicio(
                              servicio.duracionMinutos
                            )}

                            {' · '}

                            {formatearPrecioCLP(
                              servicio.precioCLP
                            )}

                          </option>

                        ))}

                      </optgroup>

                    )
                  )}

                </select>


                {/* =================================
                   FICHA DEL SERVICIO
                    Muestra precio, duración y
                    observaciones del catálogo.
                ================================= */}

                {servicioActual && (

                  <div
                    className="cita-ficha-servicio"
                    aria-live="polite"
                  >

                    <strong className="cita-ficha-servicio-nombre">
                      {servicioActual.nombre}
                    </strong>

                    <div className="cita-ficha-servicio-datos">

                      <span>

                        <b>Duración aproximada:</b>

                        {' '}

                        {formatearDuracionServicio(
                          servicioActual.duracionMinutos
                        )}

                      </span>

                      <span>

                        <b>Valor del servicio:</b>

                        {' '}

                        {formatearPrecioCLP(
                          servicioActual.precioCLP
                        )}

                      </span>

                    </div>


                    {servicioActual.nota && (

                      <p className="cita-ficha-servicio-nota">
                        {servicioActual.nota}
                      </p>

                    )}

                  </div>

                )}


                {errorDe('servicio')}


                {/* Filtro por médico desde la agenda */}

                {preferencia &&
                  medicoPreferido &&
                  especie &&
                  !medicoSinServicios && (

                  <small className="ayuda-servicio-medico">

                    Mostrando solo los servicios que realiza{' '}

                    {medicoPreferido.nombre}.

                    {' '}

                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 align-baseline"
                      onClick={() =>
                        setPreferencia(null)
                      }
                    >
                      Ver todos los servicios
                    </button>

                  </small>

                )}

              </div>

            </div>


            {/* =================================
                SELECTOR DE VETERINARIOS
            ================================= */}

           

{modoReserva === 'nueva' ? (

  <>
    {cargandoVeterinarios && (
      <p role="status" className="equipo-resumen">
        Cargando veterinarios desde MySQL...
      </p>
    )}

    {errorVeterinarios && (
      <p role="alert" className="mensaje-error">
        {errorVeterinarios}
      </p>
    )}

    {!cargandoVeterinarios && !errorVeterinarios && (
      <SelectorVeterinarioCita
        tipoMascota={datos.tipoMascota}
        otraEspecie={datos.otraEspecie}
        servicio={datos.servicio}
        veterinarioId={datos.veterinarioId}
        onSeleccionar={seleccionarVeterinario}
        error={errores.veterinarioId}
        veterinariosDisponibles={veterinariosApi}
      />
    )}
  </>

) : (


  <p className="cita-repetir-medico" role="status">

    {datos.hora && medico

      ? `🩺 Veterinario asignado: ${medico.nombre}`

      : '🩺 Elegiremos un veterinario disponible según el servicio, día y hora.'}

    {errorDe('veterinarioId')}

  </p>

)}



            {/* =================================
                FECHA Y HORA DE LA CITA
            ================================= */}

            <div className="grid-fecha">


              {/* Fecha */}

              <div className="grupo-campo">

                <label htmlFor="fechaCita">
                  Fecha *
                </label>

                
{/* =========================================
    SELECCIONAR SOLO DÍAS DE ATENCIÓN
========================================= */}

<select
  id="fechaCita"
  name="fecha"
  value={datos.fecha}
  onChange={manejarCambio}
  onBlur={() => manejarSalida('fecha')}
  disabled={
    modoReserva === 'registrada'
      ? !datos.servicio
      : !medico
  }
  aria-invalid={!!errores.fecha}
>
  <option value="">
    Selecciona un día de atención
  </option>

  {fechasParaElegir.map((fecha) => (
    <option
      key={fecha.valor}
      value={fecha.valor}
    >
      {fecha.etiqueta}
    </option>
  ))}
</select>

{errorDe('fecha')}

</div>


{/* =========================================
    SELECCIONAR SOLO HORAS DE ATENCIÓN
========================================= */}

<div className="grupo-campo">

  <label htmlFor="horaCita">
    Hora *
  </label>

  <select
    id="horaCita"
    name="hora"
    value={datos.hora}
    onChange={manejarCambio}
    onBlur={() => manejarSalida('hora')}
    disabled={
      modoReserva === 'registrada'
        ? !datos.fecha ||
          !medicosCompatibles.some(
            (vet) => atiendeDia(vet, datos.fecha)
          )
        : !medico ||
          !atiendeDia(medico, datos.fecha)
    }
    aria-invalid={!!errores.hora}
  >

    <option value="">
      Selecciona un horario
    </option>

    {HORARIOS_CITAS
      .filter((hora) => {

        // Mascota registrada
        if (modoReserva === 'registrada') {
          return horasDisponiblesRegistrada.includes(hora)
        }

        // Mascota nueva con veterinario de MySQL
        return Boolean(
          medico &&
          datos.fecha &&
          atiendeDia(medico, datos.fecha) &&
          atiendeHora(medico, hora) &&
          esFutura(datos.fecha, hora) &&
          !ocupadas.includes(hora)
        )
      })
      .map((hora) => (

        <option
          key={hora}
          value={hora}
        >
          {hora} hrs.
        </option>

      ))}
 
  </select>

  {errorDe('hora')}
  <small>La hora se confirmará al registrar la solicitud.</small>

</div>

</div>




            {/* =================================
                INFORMACIÓN DEL MÉDICO
            ================================= */}

            {medico ? (

              <p className="aviso-horario-veterinario">

                <strong>
                  Horario de {medico.nombre}:
                </strong>

                {' '}

                {medico.dias.join(', ')}

                {' · '}

                {medico.horario} hrs.

              </p>

            ) : (

              <p className="aviso-horario-veterinario">

                Selecciona un servicio y un veterinario
                para consultar sus horarios.

              </p>

            )}


            {/* Aviso si el médico no trabaja ese día */}

            {medico &&
              datos.fecha &&
              !atiendeDia(
                medico,
                datos.fecha
              ) && (

                <p
                  className="mensaje-error"
                  role="alert"
                >

                  {medico.nombre} no atiende ese día.
                  Selecciona otra fecha.

                </p>

              )}


            {/* =================================
                MOTIVO DE CONSULTA
            ================================= */}

            <div className="grupo-campo motivo-consulta">

              <label htmlFor="motivoCita">
                Cuéntanos el motivo de la consulta *
              </label>

              <textarea
                id="motivoCita"
                name="motivo"
                minLength={10}
                maxLength={500}
                required
                value={datos.motivo}
                onChange={manejarCambio}
                onBlur={() =>
                  manejarSalida('motivo')
                }
                placeholder="Ej.: Mi gatito lleva dos días sin querer comer."
                aria-invalid={!!errores.motivo}
              />

              {errorDe('motivo')}

              <div className="detalle-textarea">

                <span>
                  Mínimo 10 caracteres
                </span>

                <span>
                  {datos.motivo.length} / 500
                </span>

              </div>

            </div>

          </section>


          {/* =================================
              PASO FINAL: CONFIRMAR SOLICITUD
          ================================= */}

          <section className="bloque-confirmacion">

            <div className="confirmacion-superior">

              <div>

                <span className="etiqueta-final">
                  Último paso
                </span>

                <h3>Revisa tu solicitud</h3>

                <p>
                  Verifica que todos los datos
                  sean correctos.
                </p>

              </div>

              <div className="estado-solicitud">

                <span className="punto-estado" />

                Pendiente

              </div>

            </div>


            {/* =================================
                RESUMEN DE LA MASCOTA
            ================================= */}

            {datos.nombreMascota && (

              <div className="resumen-veterinario-elegido">

                <strong>
                  Mascota:
                </strong>

                {' '}

                {datos.nombreMascota.trim()}

                {datos.edadMascota && (

                  ` · ${datos.edadMascota} ${
                    datos.unidadEdad === 'meses'
                      ? 'mes(es)'
                      : 'año(s)'
                  }`

                )}

              </div>

            )}


            {/* =================================
               RESUMEN DEL SERVICIO
                CON PRECIO Y DURACIÓN
            ================================= */}

            {servicioActual && (

              <div className="resumen-veterinario-elegido">

                <strong>
                  Servicio:
                </strong>

                {' '}

                {servicioActual.nombre}

                <div className="cita-resumen-precio">

                  <span>

                    Duración aproximada:

                    {' '}

                    <strong>
                      {formatearDuracionServicio(
                        servicioActual.duracionMinutos
                      )}
                    </strong>

                  </span>

                  <span>

                    Valor del servicio:

                    {' '}

                    <strong>
                      {formatearPrecioCLP(
                        servicioActual.precioCLP
                      )}
                    </strong>

                  </span>

                </div>


                {servicioActual.nota && (

                  <p className="cita-resumen-nota">
                    {servicioActual.nota}
                  </p>

                )}

              </div>

            )}


            {/* =================================
                RESUMEN DEL VETERINARIO
            ================================= */}

            {medico && (

              <div className="resumen-veterinario-elegido">

                <strong>
                  Veterinario:
                </strong>

                {' '}

                {medico.nombre}

                {' · '}

                {medico.area}


                {confirmarProfesional && (

                  <p>

                    La clínica debe confirmar quién
                    realizará este procedimiento.

                  </p>

                )}

              </div>

            )}


            {/* =================================
                CONFIRMACIÓN DE LOS DATOS
            ================================= */}

            <div className="confirmacion-formulario">

              <label className="check-confirmacion">

                <input
                  type="checkbox"
                  name="confirmarDatos"
                  checked={datos.confirmarDatos}
                  onChange={manejarCambio}
                  onBlur={() =>
                    manejarSalida('confirmarDatos')
                  }
                  aria-invalid={
                    !!errores.confirmarDatos
                  }
                />

                <span>
                  Confirmo que los datos ingresados
                  son correctos.
                </span>

              </label>

              {errorDe('confirmarDatos')}

            </div>


            {/* =================================
                BOTÓN SOLICITAR CITA
            ================================= */}

            <div className="acciones-formulario-cita">

              <button
                type="submit"
                className="boton-solicitar-cita"
                disabled={enviada || enviando}
              >

                {enviada
  ? 'Solicitud enviada ✓'
  : enviando
    ? 'Guardando en MySQL...'
    : 'Solicitar cita →'}

              </button>

              <p>

                La solicitud se guardará como{' '}

                <strong>Pendiente</strong>,

                hasta que la clínica la confirme.

              </p>

            </div>


            {/* Mostrar errores generales */}

            {errorGeneral && (

              <p
                className="mensaje-error"
                role="alert"
              >
                {errorGeneral}
              </p>

            )}


            {/* =================================
                MENSAJE DE SOLICITUD REGISTRADA
            ================================= */}

            {enviada && (

              <div
                ref={mensajeExitoRef}
                className="mensaje-exito-cita mostrar"
                role="status"
                aria-live="polite"
              >

                <div className="mensaje-exito-icono">
                  ✓
                </div>

                <div className="mensaje-exito-contenido">

                  <h3>
                    ¡Solicitud enviada!
                  </h3>

                  <p>

                    La solicitud de{' '}

                    <strong>
                      {datos.nombreMascota}
                    </strong>

                    {' '}para{' '}

                    <strong>
                      {datos.servicio}
                    </strong>

                    {' '}con{' '}

                    <strong>
                      {medico?.nombre}
                    </strong>

                    {' '}quedó{' '}

                    <strong>
                      Pendiente
                    </strong>.

                  </p>


                  {/* =================================
                     AVISO DE PAGO PRESENCIAL
                  ================================= */}

                  <div
                    className="cita-aviso-pago"
                    role="note"
                  >

                    <strong>
                      Pago presencial en la veterinaria
                    </strong>

                    <p>

                      El servicio se paga directamente
                      en la veterinaria, al momento
                      de la consulta.

                      No necesitas realizar ningún
                      pago al enviar esta solicitud
                      por internet.

                    </p>


                    {/* Precio y duración de la atención */}

                    {servicioActual && (

                      <p className="cita-aviso-pago-importe">

                        Valor del servicio:

                        {' '}

                        <strong>
                          {formatearPrecioCLP(
                            servicioActual.precioCLP
                          )}
                        </strong>

                        {' · '}

                        Duración aproximada:

                        {' '}

                        {formatearDuracionServicio(
                          servicioActual.duracionMinutos
                        )}

                      </p>

                    )}

                  </div>


                  <Link
                    to="/mis-citas"
                    className="boton-ver-mis-citas"
                  >
                    Ver mis citas →
                  </Link>

                </div>

              </div>

            )}

          </section>

        </form>

      </div>

    </section>

  )
}