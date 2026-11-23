/* PÁGINA (contenedor) — Dashboard del panel (antes admin/dashboard.html).
   Muestra información distinta según el rol:
   - Administrador: usuarios + mascotas + citas, y la tabla de últimos usuarios.
   - Recepcionista: solo mascotas y citas (según el caso, no gestiona usuarios).
   EP3: todos los números vienen de report-service (GET /reportes/dashboard),
   que los consulta a los demás microservicios. */
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { mensajeDeError } from '../../services/api'
import { obtenerDashboard, type Dashboard } from '../../services/reportesService'
import { EncabezadoAdmin } from '../../componentes/organismos/EncabezadoAdmin'
import { TarjetaKpi } from '../../componentes/moleculas/TarjetaKpi'
import { AccesoRapido } from '../../componentes/moleculas/AccesoRapido'
import { AvisoServicios } from '../../componentes/moleculas/AvisoServicios'
import { Insignia, type TipoInsignia } from '../../componentes/atomos/Insignia'

export default function DashboardPage() {
  const { usuario, esAdmin } = useAuth()
  const [datos, setDatos] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    obtenerDashboard()
      .then((d) => activo && setDatos(d))
      .catch((e) => activo && setError(mensajeDeError(e)))
    return () => {
      activo = false
    }
  }, [])

  const usuarios = datos?.usuarios ?? null
  const clinica = datos?.clinica

  const kpisUsuarios = [
    { icono: '👥', numero: usuarios?.total ?? null, etiqueta: 'Usuarios registrados' },
    { icono: '✨', numero: usuarios?.nuevosEstaSemana ?? null, etiqueta: 'Nuevos esta semana' },
  ]
  const kpisClinica = [
    { icono: '🐾', numero: clinica?.mascotasRegistradas ?? null, etiqueta: 'Mascotas registradas' },
    { icono: '📅', numero: clinica?.citasPendientes ?? null, etiqueta: 'Citas pendientes' },
    {
      icono: '🔔',
      numero: clinica?.solicitudesPendientes ?? null,
      etiqueta: 'Cambios de mascotas por revisar',
      to: '/admin/mascotas',
    },
  ]
  const kpis = esAdmin ? [...kpisUsuarios, ...kpisClinica] : kpisClinica
  const ultimos = usuarios?.ultimosRegistrados ?? []

  return (
    <>
      <EncabezadoAdmin>
        Bienvenido, <span>{usuario?.nombre ?? 'Admin'}</span> 🐾
      </EncabezadoAdmin>

      {error && (
        <div className="admin-aviso admin-aviso--error" role="alert">
          {error}
        </div>
      )}
      {datos && <AvisoServicios servicios={datos.serviciosNoDisponibles} />}

      <section className="admin-kpis admin-kpis--dashboard" aria-busy={!datos && !error}>
        {kpis.map((k) => (
          <TarjetaKpi key={k.etiqueta} {...k} />
        ))}
      </section>

      <section className="admin-accesos">
        {esAdmin ? (
          <AccesoRapido icono="👥" titulo="Gestión de usuarios" descripcion="Ver, buscar y administrar cuentas registradas." to="/admin/usuarios" />
        ) : (
          <AccesoRapido icono="📅" titulo="Gestión de citas" descripcion="Confirmar o reagendar las solicitudes de cita." to="/admin/citas" />
        )}
        <AccesoRapido icono="✉️" titulo="Mensajes de contacto" descripcion="Revisar y responder las consultas del sitio." to="/admin/mensajes" />
        <AccesoRapido icono="🌐" titulo="Ver el sitio" descripcion="Abrir Patitas Felices como lo ve un visitante." to="/" />
      </section>

      {esAdmin && (
        <section className="admin-tabla-seccion">
          <h2>Últimos usuarios registrados</h2>
          {ultimos.length === 0 ? (
            <p className="admin-tabla-vacia">{datos ? 'Aún no hay usuarios registrados.' : 'Cargando…'}</p>
          ) : (
            <div className="admin-tabla-wrap table-responsive">
              <table className="admin-tabla">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Comuna</th>
                    <th>Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimos.map((u) => (
                    <tr key={u.id}>
                      <td>{u.nombre}</td>
                      <td>{u.correo}</td>
                      <td>{u.comuna || 'Sin comuna'}</td>
                      <td>
                        <Insignia tipo={u.rol.toLowerCase() as TipoInsignia} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  )
}
