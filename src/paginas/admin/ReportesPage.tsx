/* PÁGINA (contenedor) — Reportes (antes admin/reportes.html).
   Gráficos con Chart.js (react-chartjs-2).
   EP3: los datos vienen de report-service (GET /reportes/completo), que los
   consulta por WebClient a auth, mascotas, citas, contacto y notificaciones.
   "Exportar reporte completo" pide las filas a GET /reportes/exportar y arma
   un Excel con tres hojas (Usuarios, Mascotas y Citas) con SheetJS.
   Cada reporte generado queda registrado en el historial del backend. */
import { useEffect, useState, type ReactNode } from 'react'
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { mensajeDeError } from '../../services/api'
import { obtenerExportacion, obtenerReporteCompleto, type ReporteCompleto } from '../../services/reportesService'
import { recortar } from '../../utils/estadisticas'
import { exportarLibro } from '../../utils/exportarExcel'
import { EncabezadoAdmin } from '../../componentes/organismos/EncabezadoAdmin'
import { TarjetaKpi } from '../../componentes/moleculas/TarjetaKpi'
import { AvisoServicios } from '../../componentes/moleculas/AvisoServicios'
import { Boton } from '../../componentes/atomos/Boton'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const COLOR_TEXTO = 'rgba(255,255,255,0.75)'
const opcionesDona = { plugins: { legend: { labels: { color: COLOR_TEXTO } } } }
const opcionesBarras = (horizontal: boolean) => ({
  indexAxis: horizontal ? ('y' as const) : ('x' as const),
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: 'rgba(255,255,255,0.6)', precision: 0 }, grid: { color: 'rgba(255,255,255,0.06)' } },
    y: { ticks: { color: COLOR_TEXTO }, grid: { display: false } },
  },
})

function Grafico({ titulo, vacio, children }: { titulo: string; vacio: boolean; children: ReactNode }) {
  return (
    <div className="admin-grafico-card">
      <h2>{titulo}</h2>
      {vacio ? <p className="admin-tabla-vacia">Sin datos todavía.</p> : children}
    </div>
  )
}

/** Sección de un microservicio que no respondió. */
function SinServicio({ servicio }: { servicio: string }) {
  return <p className="admin-tabla-vacia">Datos no disponibles: {servicio} no respondió.</p>
}

export default function ReportesPage() {
  const [reporte, setReporte] = useState<ReporteCompleto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    let activo = true
    obtenerReporteCompleto()
      .then((r) => activo && setReporte(r))
      .catch((e) => activo && setError(mensajeDeError(e)))
    return () => {
      activo = false
    }
  }, [])

  const exportarTodo = async () => {
    setExportando(true)
    try {
      const { hojas, nombreArchivo } = await obtenerExportacion()
      exportarLibro(hojas, nombreArchivo)
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setExportando(false)
    }
  }

  if (!reporte) {
    return (
      <>
        <EncabezadoAdmin>Reportes 🐾</EncabezadoAdmin>
        {error ? (
          <div className="admin-aviso admin-aviso--error" role="alert">
            {error}
          </div>
        ) : (
          <p className="admin-tabla-vacia">Generando reporte…</p>
        )}
      </>
    )
  }

  const { usuarios, mascotas, citas } = reporte

  return (
    <>
      <EncabezadoAdmin>Reportes 🐾</EncabezadoAdmin>
      {error && (
        <div className="admin-aviso admin-aviso--error" role="alert">
          {error}
        </div>
      )}
      <AvisoServicios servicios={reporte.serviciosNoDisponibles} />

      {/* -------- USUARIOS (auth-service) -------- */}
      <section className="admin-kpis">
        <TarjetaKpi icono="👥" numero={usuarios?.total ?? null} etiqueta="Usuarios totales" />
        <TarjetaKpi icono="🛡️" numero={usuarios?.administradores ?? null} etiqueta="Administradores" />
        <TarjetaKpi icono="📍" numero={usuarios?.regionesConUsuarios ?? null} etiqueta="Regiones con usuarios" />
        <TarjetaKpi icono="🖼️" numero={usuarios?.conFotoPerfil ?? null} etiqueta="Con foto de perfil" />
      </section>

      {usuarios ? (
        <>
          <section className="admin-graficos">
            <Grafico titulo="Usuarios por rol" vacio={usuarios.total === 0}>
              <Doughnut
                options={opcionesDona}
                data={{
                  labels: ['Clientes', 'Recepcionistas', 'Administradores'],
                  datasets: [
                    {
                      data: [usuarios.clientes, usuarios.recepcionistas, usuarios.administradores],
                      backgroundColor: ['#D6ECFA', '#C8F0D8', '#FFD6E7'],
                      borderColor: '#2A2440',
                      borderWidth: 3,
                    },
                  ],
                }}
              />
            </Grafico>
            <Grafico titulo="Usuarios por región" vacio={usuarios.porRegion.length === 0}>
              <Bar
                options={opcionesBarras(true)}
                data={{
                  labels: usuarios.porRegion.map((r) => recortar(r.nombre, 22)),
                  datasets: [{ label: 'Usuarios', data: usuarios.porRegion.map((r) => r.cantidad), backgroundColor: '#E6D6F7', borderRadius: 8 }],
                }}
              />
            </Grafico>
          </section>

          <section className="admin-tabla-seccion">
            <h2>Comunas con más usuarios registrados</h2>
            {usuarios.topComunas.length === 0 ? (
              <p className="admin-tabla-vacia">Aún no hay suficientes datos de comunas.</p>
            ) : (
              <div className="admin-tabla-wrap table-responsive">
                <table className="admin-tabla">
                  <thead>
                    <tr>
                      <th>Comuna</th>
                      <th>Región</th>
                      <th>Usuarios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.topComunas.map((c) => (
                      <tr key={`${c.comuna}-${c.region}`}>
                        <td>{c.comuna}</td>
                        <td>{c.region}</td>
                        <td>{c.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <SinServicio servicio="auth-service" />
      )}

      {/* -------- MASCOTAS (mascota-service) -------- */}
      <h2 className="admin-reportes-subtitulo">Reporte de mascotas 🐾</h2>
      <section className="admin-kpis">
        <TarjetaKpi icono="🐾" numero={mascotas?.total ?? null} etiqueta="Mascotas registradas" />
        <TarjetaKpi icono="⚠️" numero={mascotas?.conDatosIncompletos ?? null} etiqueta="Con datos incompletos" />
        <TarjetaKpi icono="🔔" numero={mascotas?.solicitudesPendientes ?? null} etiqueta="Solicitudes de cambio pendientes" />
        <TarjetaKpi icono="🩺" numero={mascotas?.porEstado.tratamiento ?? null} etiqueta="En tratamiento" />
      </section>
      {mascotas ? (
        <section className="admin-graficos">
          <Grafico titulo="Mascotas por especie" vacio={mascotas.total === 0}>
            <Doughnut
              options={opcionesDona}
              data={{
                labels: mascotas.porEspecie.map((e) => e.nombre),
                datasets: [
                  {
                    data: mascotas.porEspecie.map((e) => e.cantidad),
                    backgroundColor: ['#D6ECFA', '#FFD6E7', '#E6D6F7', '#FFD6A5', '#C8F0D8', '#F7E6A1'],
                    borderColor: '#2A2440',
                    borderWidth: 3,
                  },
                ],
              }}
            />
          </Grafico>
          <Grafico titulo="Mascotas por estado clínico" vacio={mascotas.total === 0}>
            <Bar
              options={opcionesBarras(false)}
              data={{
                labels: ['Control al día', 'En tratamiento', 'Vacunas pendientes'],
                datasets: [
                  {
                    label: 'Mascotas',
                    data: [mascotas.porEstado.alDia, mascotas.porEstado.tratamiento, mascotas.porEstado.pendiente],
                    backgroundColor: ['#C8F0D8', '#E6D6F7', '#FFD6A5'],
                    borderRadius: 8,
                  },
                ],
              }}
            />
          </Grafico>
        </section>
      ) : (
        <SinServicio servicio="mascota-service" />
      )}

      {/* -------- CITAS (cita-service) -------- */}
      <h2 className="admin-reportes-subtitulo">Reporte de citas 📅</h2>
      <section className="admin-kpis">
        <TarjetaKpi icono="📅" numero={citas?.total ?? null} etiqueta="Citas totales" />
        <TarjetaKpi icono="⏰" numero={citas?.pendientes ?? null} etiqueta="Pendientes" />
        <TarjetaKpi icono="✅" numero={citas?.confirmadas ?? null} etiqueta="Confirmadas" />
        <TarjetaKpi icono="❌" numero={citas?.canceladas ?? null} etiqueta="Canceladas" />
      </section>
      {citas ? (
        <section className="admin-graficos">
          <Grafico titulo="Citas por estado" vacio={citas.total === 0}>
            <Doughnut
              options={opcionesDona}
              data={{
                labels: ['Pendientes', 'Confirmadas', 'Canceladas'],
                datasets: [
                  {
                    data: [citas.pendientes, citas.confirmadas, citas.canceladas],
                    backgroundColor: ['#FFD6A5', '#C8F0D8', '#F0A0A0'],
                    borderColor: '#2A2440',
                    borderWidth: 3,
                  },
                ],
              }}
            />
          </Grafico>
          <Grafico titulo="Servicios más solicitados" vacio={citas.porServicio.length === 0}>
            <Bar
              options={opcionesBarras(true)}
              data={{
                labels: citas.porServicio.map((s) => recortar(s.nombre, 24)),
                datasets: [{ label: 'Citas', data: citas.porServicio.map((s) => s.cantidad), backgroundColor: '#D6ECFA', borderRadius: 8 }],
              }}
            />
          </Grafico>
        </section>
      ) : (
        <SinServicio servicio="cita-service" />
      )}

      {/* -------- CONTACTO Y NOTIFICACIONES -------- */}
      <h2 className="admin-reportes-subtitulo">Contacto y avisos ✉️</h2>
      <section className="admin-kpis">
        <TarjetaKpi icono="✉️" numero={reporte.contacto?.total ?? null} etiqueta="Mensajes de contacto" to="/admin/mensajes" />
        <TarjetaKpi icono="📨" numero={reporte.contacto?.pendiente ?? null} etiqueta="Mensajes sin revisar" to="/admin/mensajes" />
        <TarjetaKpi icono="🔔" numero={reporte.notificaciones?.total ?? null} etiqueta="Avisos enviados" />
        <TarjetaKpi icono="👀" numero={reporte.notificaciones?.noLeidas ?? null} etiqueta="Avisos sin leer" />
      </section>

      <div className="admin-reportes-exportar">
        <Boton variante="exportar" onClick={exportarTodo} disabled={exportando}>
          {exportando ? 'Preparando Excel…' : '📤 Exportar reporte completo (Excel)'}
        </Boton>
      </div>
    </>
  )
}
