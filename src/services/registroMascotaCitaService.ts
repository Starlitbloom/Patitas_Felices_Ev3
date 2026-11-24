/* =========================================================
   PATITAS FELICES
   REGISTRAR MASCOTA DESDE SOLICITAR CITA

   - Guarda la mascota al registrar una cita.
   - EP3: la guarda en mascota-service (8082), igual que "Mis mascotas".
   - Evita crear mascotas duplicadas.
   - Asigna una imagen según la especie.
   - Permite completar sus datos posteriormente.
========================================================= */

import type { Mascota } from '../types/mascota'

import {
  crearMascota,
  listarMascotas
} from './mascotasService'

/* =========================================================
   DATOS RECIBIDOS DESDE SOLICITAR CITA
========================================================= */

interface MascotaDeCita {
  nombre: string
  especie: Mascota['especie']
  edad: string
  dueño: string
  correoDueño: string
}

/* =========================================================
   OBTENER IMAGEN SEGÚN ESPECIE
   Usa las mismas imágenes que aparecen al seleccionar
   el tipo de mascota en Solicitar Cita.
========================================================= */

function obtenerImagenMascota(
  especie: Mascota['especie']
): string {

  switch (especie) {

    case 'Perro':
      return '/img/icono-perro.png'

    case 'Gato':
      return '/img/icono-gato.png'

    case 'Conejo':
    case 'Ave':
      return '/img/icono-otro.png'

    default:
      return '/img/icono-otro.png'
  }
}

/* =========================================================
   REGISTRAR MASCOTA
========================================================= */

export async function registrarMascotaDesdeCita(
  datos: MascotaDeCita
): Promise<Mascota> {
  /* Obtener las mascotas que ve el usuario (un cliente solo recibe las suyas) */
  const lista = await listarMascotas()

  const nombre = datos.nombre.trim()
  const correoDueño = datos.correoDueño.trim()

  /* Normalizar textos para compararlos */
  const normalizar = (texto: string) =>
    texto.trim().toLocaleLowerCase('es-CL')

  /* Comprobar si la mascota ya está registrada */
  const existente = lista.find(
    (mascota) =>
      normalizar(mascota.correoDueño) === normalizar(correoDueño) &&
      normalizar(mascota.nombre) === normalizar(nombre) &&
      mascota.especie === datos.especie
  )

  /* Si existe, se conserva su ficha original */
  if (existente) {
    return existente
  }

  /* Crear nueva mascota (incompleta: el dueño completa raza, sexo y peso después) */
  const resultado = await crearMascota({
    nombre,
    especie: datos.especie,
    edad: datos.edad,
    raza: '',
    sexo: '',
    peso: '',
    dueño: datos.dueño.trim(),
    correoDueño,
    completo: false,
    imagen: obtenerImagenMascota(datos.especie),
    estado: 'pendiente',
    descripcion: ''
  })

  /* Si el backend la rechazó, quien llama muestra el aviso */
  if (!resultado.ok) {
    throw new Error(resultado.mensaje)
  }

  return resultado.dato
}