/* Muestra solo las mascotas del dueño/a que inició sesión.
   Debe ir protegida con RutaProtegida: sin sesión no sabemos
   de quién son las mascotas que hay que mostrar.
   EP3: las mascotas se piden a mascota-service (8082) con el token del usuario. */
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { FiltrosMascotas as Filtros, Mascota } from '../types/mascota'
import { alternarFavorita, filtrarMascotas, listarMascotasPorDueno, obtenerFavoritos } from '../services/mascotasService'
import { mensajeDeError } from '../services/api'
import { FiltrosMascotas } from '../componentes/organismos/FiltrosMascotas'
import { GrillaMascotas } from '../componentes/organismos/GrillaMascotas'
import { TituloSeccion } from '../componentes/moleculas/TituloSeccion'
import { CuidadosPorEspecie } from '../componentes/organismos/CuidadosPorEspecie'
import { VideoCuidados } from '../componentes/organismos/VideoCuidados'
import { HeroMascotas } from '../componentes/organismos/HeroMascotas'

const SIN_FILTROS: Filtros = { texto: '', especie: '', soloFavoritas: false }

export default function MisMascotasPage() {
  const { usuario } = useAuth()
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)
  // "favoritos" se guarda en estado aparte para que, al tocar el corazón,
  // la grilla se vuelva a pintar (alternarFavorita() escribe en localStorage,
  // pero React no sabe que localStorage cambió si no actualizamos el estado).
  const [favoritos, setFavoritos] = useState<string[]>(() => obtenerFavoritos())

  /* Mascotas del dueño (vienen del backend), si todavía se están cargando y el error si falló */
  const [mascotasDelDueno, setMascotasDelDueno] = useState<Mascota[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const correo = usuario?.correo

  /* Al entrar a la página (o si cambia el usuario) se piden sus mascotas a mascota-service */
  useEffect(() => {
    if (!correo) return
    let activo = true
    listarMascotasPorDueno(correo)
      .then((lista) => activo && setMascotasDelDueno(lista))
      .catch((e) => activo && setError(mensajeDeError(e)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [correo])

  const visibles = filtrarMascotas(mascotasDelDueno, filtros)

  const manejarFavorita = (id: string) => {
    alternarFavorita(id)
    setFavoritos(obtenerFavoritos())
  }

  return (
    <main className="seccion-mascotas seccion-mascotas--con-hero">
      <HeroMascotas />
      {/* Zona con fondo lila → rosa, a todo el ancho */}
      <section className="fondo-catalogo-mascotas">
        <div className="contenedor catalogo-mascotas" id="catalogo-mascotas">
          <TituloSeccion
            etiqueta="Tus mascotas"
            titulo="Mascotas registradas"
            descripcion="Aquí encontrarás las mascotas asociadas a tu cuenta. Revisa su ficha clínica, historial, vacunas y controles."
          />

          <FiltrosMascotas filtros={filtros} onCambio={setFiltros} onLimpiar={() => setFiltros(SIN_FILTROS)} />

          {error && (
            <p className="alerta-mascota" role="alert">
              ⚠️ {error}
            </p>
          )}

          <p className="mascotas-resumen" aria-live="polite">
            {cargando
              ? 'Cargando mascotas…'
              : `${visibles.length} ${visibles.length === 1 ? 'mascota encontrada' : 'mascotas encontradas'}`}
          </p>

          <GrillaMascotas mascotas={visibles} favoritos={favoritos} onAlternarFavorita={manejarFavorita} />
          </div>
        </section>
        {/* Zona con el mismo fondo del banner de Novedades, a todo el ancho */}
        <div className="fondo-cuidados">
          <CuidadosPorEspecie />
        </div>
        <VideoCuidados />
      </main>
  )
}